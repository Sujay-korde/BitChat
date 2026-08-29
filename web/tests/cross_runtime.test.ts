import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { WebCryptoProvider } from '../src/core/crypto/WebCryptoProvider';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { webcrypto } from 'node:crypto';

// Polyfill for Node environment
if (typeof crypto === 'undefined') {
  (global as any).crypto = webcrypto;
}

const PYTHON_EXECUTABLE = process.platform === 'win32' ? '..\\.venv\\Scripts\\python.exe' : '../.venv/bin/python';

describe('Cross-Runtime Crypto Interoperability', () => {
  let jsCrypto: WebCryptoProvider;

  beforeEach(async () => {
    jsCrypto = new WebCryptoProvider();
    await jsCrypto.generateIdentity();
  });

  it('Test A & B: Python <-> Browser full encrypt/decrypt', async () => {
    const jsPayload = await jsCrypto.getPublicKey("js", "py");
    const plaintextFromJs = "Hello from JavaScript!";
    
    // We will write a small python script that:
    // 1. Generates its own key.
    // 2. Derives shared secret with JS.
    // 3. Encrypts a message to JS.
    // 4. Decrypts a message from JS.
    // It accepts JS pub key and JS ciphertext via stdin JSON, and prints Python pub key and Python ciphertext via stdout JSON.
    
    const pyScript = `
import sys, json, base64
sys.path.insert(0, '../src')
from securechat.client.crypto import ChatCrypto

input_data = json.loads(sys.stdin.read())
js_payload = input_data['jsPayload']

crypto = ChatCrypto()
py_payload = crypto.get_key_exchange_payload("py", "js")

shared_key = crypto.verify_and_derive_shared_key("js", "py", js_payload)

# Decrypt JS ciphertext
try:
    decrypted_js = crypto.decrypt(shared_key, js_ciphertext)
    assert decrypted_js.get("text") == js_plaintext, "Python failed to decrypt JS text correctly"
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)

# Encrypt Python message
py_plaintext = "Hello from Python!"
py_ciphertext = crypto.encrypt(shared_key, {"text": py_plaintext})

print(json.dumps({
    "pyPubB64": py_pub_b64,
    "pyCiphertext": py_ciphertext
}))
`;
    
    // To do this properly, we need Python's public key first to encrypt for Python, but we are doing it in one shot:
    // Wait, if Python is a script, we can't do one-shot easily unless Python runs twice, 
    // or JS generates ciphertext for a DUMMY key just to see if Python fails? No, JS needs Python's pub key to derive shared secret.
    // Let's do it in two steps.
    
    // Step 1: Python generates identity, takes JS pub key, derives shared secret, encrypts message, and prints its pub key and ciphertext.
    const pyScript1 = `
import sys, json, base64
sys.path.insert(0, '../src')
from securechat.client.crypto import ChatCrypto

input_data = json.loads(sys.stdin.read())
js_payload = input_data['jsPayload']

crypto = ChatCrypto()
py_payload = crypto.get_key_exchange_payload("py", "js")

shared_key = crypto.verify_and_derive_shared_key("js", "py", js_payload)
py_ciphertext = crypto.encrypt(shared_key, {"text": "Message from Python"})

py_priv_b64 = base64.b64encode(crypto._private_key.private_bytes_raw()).decode('ascii')
py_id_priv_b64 = base64.b64encode(crypto._identity_key.private_bytes_raw()).decode('ascii')

print(json.dumps({
    "pyPayload": py_payload,
    "pyPrivB64": py_priv_b64,
    "pyIdPrivB64": py_id_priv_b64,
    "pyCiphertext": py_ciphertext
}))
`;
    
    const pyFile1 = path.join(__dirname, 'temp1.py');
    fs.writeFileSync(pyFile1, pyScript1);
    
    const pyRes1 = execSync(PYTHON_EXECUTABLE + ' ' + pyFile1, {
      input: JSON.stringify({ jsPayload }),
      encoding: 'utf-8'
    });
    
    fs.unlinkSync(pyFile1);
    
    const pyData1 = JSON.parse(pyRes1);
    const pyPayload = pyData1.pyPayload;
    const pyPrivB64 = pyData1.pyPrivB64;
    const pyIdPrivB64 = pyData1.pyIdPrivB64;
    const pyCiphertext = pyData1.pyCiphertext;

    // Test A: Python -> Browser
    const jsSharedKey = await jsCrypto.deriveSharedKey("py", "js", pyPayload);
    const decryptedPy = await jsCrypto.decrypt(jsSharedKey, pyCiphertext);
    
    // Py decrypted is actually a JSON string because JS decrypt returns plaintext directly,
    // and Python encrypts JSON dumped string `{"text": "Message from Python"}`.
    const decryptedPyObj = JSON.parse(decryptedPy);
    expect(decryptedPyObj.text).toBe("Message from Python");

    // Test B: Browser -> Python
    const payload = JSON.stringify({ text: "Message from JavaScript" });
    const jsCiphertext = await jsCrypto.encrypt(jsSharedKey, payload);

    const pyScript2 = `
import sys, json, base64
sys.path.insert(0, '../src')
from cryptography.hazmat.primitives.asymmetric import x25519, ed25519
from securechat.client.crypto import ChatCrypto

input_data = json.loads(sys.stdin.read())
js_payload = input_data['jsPayload']
py_priv_b64 = input_data['pyPrivB64']
py_id_priv_b64 = input_data['pyIdPrivB64']
js_ciphertext = input_data['jsCiphertext']

# Reconstruct Python crypto identity
crypto = ChatCrypto()
crypto._private_key = x25519.X25519PrivateKey.from_private_bytes(base64.b64decode(py_priv_b64.encode('ascii')))
crypto._public_key = crypto._private_key.public_key()
crypto._identity_key = ed25519.Ed25519PrivateKey.from_private_bytes(base64.b64decode(py_id_priv_b64.encode('ascii')))

shared_key = crypto.verify_and_derive_shared_key("js", "py", js_payload)
decrypted = crypto.decrypt(shared_key, js_ciphertext)

print(json.dumps({"decryptedText": decrypted.get("text")}))
`;

    const pyFile2 = path.join(__dirname, 'temp2.py');
    fs.writeFileSync(pyFile2, pyScript2);

    const pyRes2 = execSync(PYTHON_EXECUTABLE + ' ' + pyFile2, {
      input: JSON.stringify({ jsPayload, pyPrivB64, pyIdPrivB64, jsCiphertext }),
      encoding: 'utf-8'
    });
    
    fs.unlinkSync(pyFile2);

    const pyData2 = JSON.parse(pyRes2);
    expect(pyData2.decryptedText).toBe("Message from JavaScript");
  });
});
