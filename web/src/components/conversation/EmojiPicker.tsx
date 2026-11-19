import { useState, useMemo, useRef } from 'react';
import styles from './EmojiPicker.module.css';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: Array<{ char: string; name: string }>;
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😃',
    emojis: [
      { char: '😀', name: 'grinning face smile happy' },
      { char: '😃', name: 'grinning face big eyes' },
      { char: '😄', name: 'grinning face smiling eyes' },
      { char: '😁', name: 'beaming face smiling eyes' },
      { char: '😆', name: 'grinning squinting face laugh' },
      { char: '😅', name: 'sweat smile nervous relief' },
      { char: '🤣', name: 'rolling on the floor laughing rofl' },
      { char: '😂', name: 'face with tears of joy lol laugh' },
      { char: '🙂', name: 'slightly smiling face' },
      { char: '🙃', name: 'upside down face sarcasm ironical' },
      { char: '😉', name: 'winking face wink' },
      { char: '😊', name: 'smiling face with smiling eyes blush' },
      { char: '😇', name: 'smiling face with halo angel innocent' },
      { char: '🥰', name: 'smiling face with hearts love in love' },
      { char: '😍', name: 'heart eyes love admire' },
      { char: '🤩', name: 'star struck excited' },
      { char: '😘', name: 'face blowing a kiss kiss love' },
      { char: '😗', name: 'kissing face kiss' },
      { char: '😚', name: 'kissing face with closed eyes' },
      { char: '😙', name: 'kissing face with smiling eyes' },
      { char: '😋', name: 'face savoring food delicious yum' },
      { char: '😛', name: 'face with tongue playful silly' },
      { char: '😜', name: 'winking face with tongue crazy' },
      { char: '🤪', name: 'zany face goofy wild' },
      { char: '😝', name: 'squinting face with tongue' },
      { char: '🤑', name: 'money mouth face rich dollars' },
      { char: '🤗', name: 'smiling face with open hands hug' },
      { char: '🤭', name: 'face with hand over mouth oops giggle' },
      { char: '🤫', name: 'shushing face quiet silence hush' },
      { char: '🤔', name: 'thinking face think hmm consider' },
      { char: '🤐', name: 'zipper mouth face secret mute' },
      { char: '🤨', name: 'face with raised eyebrow suspicious' },
      { char: '😐', name: 'neutral face straight poker' },
      { char: '😑', name: 'expressionless face blank unamused' },
      { char: '😶', name: 'face without mouth speechless' },
      { char: '😏', name: 'smirking face smirk flirt smug' },
      { char: '😒', name: 'unamused face bored displeased' },
      { char: '🙄', name: 'face with rolling eyes eye roll whatever' },
      { char: '😬', name: 'grimacing face awkward yikes' },
      { char: '🤥', name: 'lying face pinocchio liar' },
      { char: '😌', name: 'relieved face calm peace' },
      { char: '😔', name: 'pensive face sad dejected' },
      { char: '😪', name: 'sleepy face tired' },
      { char: '🤤', name: 'drooling face hungry' },
      { char: '😴', name: 'sleeping face zzz snore asleep' },
      { char: '😷', name: 'face with medical mask sick covid' },
      { char: '🤒', name: 'face with thermometer illness fever' },
      { char: '🤕', name: 'face with head bandage hurt injured' },
      { char: '🤢', name: 'nauseated face sick disgust green' },
      { char: '🤮', name: 'face vomiting puke gross' },
      { char: '🤧', name: 'sneezing face sneeze allergy cold' },
      { char: '🥵', name: 'hot face sweating fever heat summer' },
      { char: '🥶', name: 'cold face freezing winter ice' },
      { char: '🥴', name: 'woozy face drunk tipsy dazed' },
      { char: '😵', name: 'dizzy face shocked dead' },
      { char: '🤯', name: 'exploding head mind blown shock' },
      { char: '🤠', name: 'cowboy hat face western yeehaw' },
      { char: '🥳', name: 'partying face celebrate birthday' },
      { char: '😎', name: 'smiling face with sunglasses cool rad' },
      { char: '🤓', name: 'nerd face geek smart glasses' },
      { char: '🧐', name: 'face with monocle curious classy' },
      { char: '😕', name: 'confused face unsure puzzled' },
      { char: '😟', name: 'worried face anxious concerned' },
      { char: '🙁', name: 'slightly frowning face unhappy' },
      { char: '😮', name: 'face with open mouth surprised wow' },
      { char: '😯', name: 'hushed face stunned speechless' },
      { char: '😲', name: 'astonished face amazed shock' },
      { char: '😳', name: 'flushed face embarrassed blush' },
      { char: '🥺', name: 'pleading face puppy eyes beg cute' },
      { char: '😦', name: 'frowning face with open mouth' },
      { char: '😧', name: 'anguished face painful' },
      { char: '😨', name: 'fearful face scared frightened' },
      { char: '😰', name: 'anxious face with sweat nervous panic' },
      { char: '😥', name: 'sad but relieved face whew' },
      { char: '😢', name: 'crying face tear sad' },
      { char: '😭', name: 'loudly crying face sobbing weep bawling' },
      { char: '😱', name: 'face screaming in fear horror panic scream' },
      { char: '😖', name: 'confounded face frustrated' },
      { char: '😣', name: 'persevering face struggle' },
      { char: '😞', name: 'disappointed face sad regret' },
      { char: '😓', name: 'downcast face with sweat stress' },
      { char: '😩', name: 'weary face exhausted tired whine' },
      { char: '😫', name: 'tired face upset drained' },
      { char: '🥱', name: 'yawning face yawn sleepy' },
      { char: '😤', name: 'face with steam from nose triumph angry' },
      { char: '😡', name: 'pouting face mad rage furious angry' },
      { char: '😠', name: 'angry face mad annoyed' },
      { char: '🤬', name: 'face with symbols on mouth swearing cursing' },
      { char: '😈', name: 'smiling face with horns devil evil mischievous' },
      { char: '👿', name: 'angry face with horns demon devil' },
      { char: '💀', name: 'skull dead skeleton dying lol' },
      { char: '☠️', name: 'skull and crossbones poison danger death' },
      { char: '💩', name: 'pile of poo poop crap' },
      { char: '🤡', name: 'clown face circus foolish' },
      { char: '👻', name: 'ghost spooky halloween boo' },
      { char: '👽', name: 'alien ufo extraterrestrial' },
      { char: '👾', name: 'alien monster retro arcade space' },
      { char: '🤖', name: 'robot face bot android' },
    ],
  },
  {
    id: 'people',
    name: 'People & Gestures',
    icon: '👋',
    emojis: [
      { char: '👋', name: 'waving hand wave hello goodbye hi' },
      { char: '🤚', name: 'raised back of hand' },
      { char: '🖐️', name: 'hand with fingers splayed five' },
      { char: '✋', name: 'raised hand stop high five' },
      { char: '🖖', name: 'vulcan salute star trek spock' },
      { char: '👌', name: 'ok hand perfect fine nice' },
      { char: '🤌', name: 'pinched fingers italian chef kiss' },
      { char: '🤏', name: 'pinching hand small tiny little bit' },
      { char: '✌️', name: 'victory hand peace sign two' },
      { char: '🤞', name: 'crossed fingers good luck hope' },
      { char: '🫰', name: 'hand with index finger and thumb crossed finger heart korean' },
      { char: '🤟', name: 'love you gesture ily rock on' },
      { char: '🤘', name: 'sign of the horns rock metal' },
      { char: '🤙', name: 'call me hand phone shaka hang loose' },
      { char: '👈', name: 'backhand index pointing left' },
      { char: '👉', name: 'backhand index pointing right' },
      { char: '👆', name: 'backhand index pointing up' },
      { char: '👇', name: 'backhand index pointing down' },
      { char: '☝️', name: 'index pointing up one question' },
      { char: '👍', name: 'thumbs up approve yes like good ok' },
      { char: '👎', name: 'thumbs down disapprove no dislike bad' },
      { char: '✊', name: 'raised fist solidarity power punch' },
      { char: '👊', name: 'oncoming fist fist bump attack' },
      { char: '🤛', name: 'left-facing fist bump' },
      { char: '🤜', name: 'right-facing fist bump' },
      { char: '👏', name: 'clapping hands applause bravo praise' },
      { char: '🙌', name: 'raising hands celebration praise hooray' },
      { char: '🫶', name: 'heart hands love care' },
      { char: '👐', name: 'open hands welcome' },
      { char: '🤲', name: 'palms up together prayer offering' },
      { char: '🤝', name: 'handshake deal agreement partnership' },
      { char: '🙏', name: 'folded hands pray please thank you namaste bless' },
      { char: '✍️', name: 'writing hand write signature note' },
      { char: '💅', name: 'nail polish sassy fabulous beauty' },
      { char: '🤳', name: 'selfie photo camera picture' },
      { char: '💪', name: 'flexed biceps muscle strong fitness flex workout' },
      { char: '🦵', name: 'leg kick limb' },
      { char: '🦶', name: 'foot step walk' },
      { char: '👂', name: 'ear hear listen sound' },
      { char: '👃', name: 'nose smell sniff' },
      { char: '🧠', name: 'brain smart think mind genius' },
      { char: '👀', name: 'eyes look see glance observe spy' },
      { char: '👁️', name: 'eye look vision watch' },
      { char: '👅', name: 'tongue taste lick silly' },
      { char: '👄', name: 'mouth lips kiss speak' },
      { char: '🫦', name: 'biting lip flirt anxious nervous' },
      { char: '👤', name: 'bust in silhouette user account person' },
      { char: '👥', name: 'busts in silhouette group team users people' },
      { char: '🫂', name: 'people hugging hug comfort support' },
    ],
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      { char: '🐶', name: 'dog face puppy pet canine bark woof' },
      { char: '🐱', name: 'cat face kitten pet feline meow' },
      { char: '🐭', name: 'mouse face rodent cheese' },
      { char: '🐹', name: 'hamster face cute pet' },
      { char: '🐰', name: 'rabbit face bunny cute hop' },
      { char: '🦊', name: 'fox face sly clever' },
      { char: '🐻', name: 'bear face grizzly teddy' },
      { char: '🐼', name: 'panda face bamboo cute china' },
      { char: '🐨', name: 'koala australia eucalyptus' },
      { char: '🐯', name: 'tiger face wild feline stripes roar' },
      { char: '🦁', name: 'lion face king beast safari roar' },
      { char: '🐮', name: 'cow face farm moo milk' },
      { char: '🐷', name: 'pig face farm oink pork' },
      { char: '🐸', name: 'frog face ribbit toad green' },
      { char: '🐵', name: 'monkey face cute primate chimp' },
      { char: '🙈', name: 'see no evil monkey shy peek' },
      { char: '🙉', name: 'hear no evil monkey loud sound' },
      { char: '🙊', name: 'speak no evil monkey secret quiet oops' },
      { char: '🐔', name: 'chicken poultry rooster farm' },
      { char: '🐧', name: 'penguin bird antarctica cold waddle' },
      { char: '🐦', name: 'bird tweet flying animal' },
      { char: '🐤', name: 'baby chick cute little bird' },
      { char: '🦆', name: 'duck quack pond waterfowl' },
      { char: '🦅', name: 'eagle raptor bird prey freedom usa' },
      { char: '🦉', name: 'owl wise night hoot bird' },
      { char: '🦇', name: 'bat vampire spooky halloween night' },
      { char: '🐺', name: 'wolf howl wild pack moonlight' },
      { char: '🐴', name: 'horse face pony steed gallop' },
      { char: '🦄', name: 'unicorn magic fantasy rainbow horse' },
      { char: '🐝', name: 'honeybee bee honey buzz insect' },
      { char: '🐛', name: 'bug caterpillar insect larva' },
      { char: '🦋', name: 'butterfly beautiful wings flying insect' },
      { char: '🐌', name: 'snail slow shell garden' },
      { char: '🐞', name: 'lady beetle ladybug insect lucky red' },
      { char: '🐜', name: 'ant tiny insect colony hill' },
      { char: '🪰', name: 'fly housefly pest bug' },
      { char: '🕷️', name: 'spider arachnid web scary spooky' },
      { char: '🐢', name: 'turtle tortoise slow shell reptile' },
      { char: '🐍', name: 'snake serpent reptile venom hiss' },
      { char: '🐙', name: 'octopus tentacles sea ocean sea creature' },
      { char: '🦑', name: 'squid calamari ocean sea monster' },
      { char: '🦐', name: 'shrimp prawn seafood shell' },
      { char: '🦀', name: 'crab crustacean ocean sea beach' },
      { char: '🐡', name: 'blowfish pufferfish toxic sea ocean' },
      { char: '🐠', name: 'tropical fish aquarium ocean colorful' },
      { char: '🐟', name: 'fish swimming sea river seafood' },
      { char: '🐬', name: 'dolphin ocean intelligent marine water' },
      { char: '🐳', name: 'spouting whale ocean giant marine' },
      { char: '🦈', name: 'shark ocean predator jaws fin danger' },
      { char: '🌲', name: 'evergreen tree pine forest nature woods' },
      { char: '🌳', name: 'deciduous tree nature park forest green' },
      { char: '🌴', name: 'palm tree beach tropical vacation island summer' },
      { char: '🌵', name: 'cactus desert plant arid prick thorn' },
      { char: '🌿', name: 'herb plant leaf nature organic greens' },
      { char: '🍀', name: 'four leaf clover lucky luck irish st patricks' },
      { char: '🍁', name: 'maple leaf autumn fall canada foliage' },
      { char: '🍂', name: 'fallen leaf autumn wind seasonal' },
      { char: '🍄', name: 'mushroom fungus toadstool mario nature' },
      { char: '🌸', name: 'cherry blossom flower sakura pink spring' },
      { char: '🌹', name: 'rose flower love romance red valentine' },
      { char: '🌺', name: 'hibiscus flower tropical hawaii exotic' },
      { char: '🌻', name: 'sunflower yellow sunny summer bright' },
      { char: '🌼', name: 'blossom flower yellow daisy spring' },
      { char: '🌷', name: 'tulip flower spring netherlands garden' },
      { char: '🔥', name: 'fire flame hot lit burn warm energy' },
      { char: '✨', name: 'sparkles sparkle magic shine shiny glitter clean new' },
      { char: '⭐', name: 'star gold favorite rating celestial night' },
      { char: '🌟', name: 'glowing star shine light sparkle' },
      { char: '⚡', name: 'high voltage lightning bolt power electric energy charge fast' },
      { char: '🌈', name: 'rainbow colorful weather pride sky beautiful' },
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍔',
    emojis: [
      { char: '🍏', name: 'green apple fruit healthy granny smith' },
      { char: '🍎', name: 'red apple fruit delicious food' },
      { char: '🍐', name: 'pear fruit sweet green' },
      { char: '🍊', name: 'tangerine orange citrus fruit vitamin' },
      { char: '🍋', name: 'lemon citrus sour yellow fruit' },
      { char: '🍌', name: 'banana fruit monkey yellow potassium' },
      { char: '🍉', name: 'watermelon fruit summer sweet melon' },
      { char: '🍇', name: 'grapes fruit wine purple vine' },
      { char: '🍓', name: 'strawberry berry red sweet summer' },
      { char: '🫐', name: 'blueberries berry antioxidant superfood' },
      { char: '🍈', name: 'melon cantaloupe honeydew sweet' },
      { char: '🍒', name: 'cherries fruit sweet red pair' },
      { char: '🍑', name: 'peach fruit butt sweet fuzzy' },
      { char: '🥭', name: 'mango tropical fruit sweet delicious' },
      { char: '🍍', name: 'pineapple tropical fruit sweet yellow pina colada' },
      { char: '🥥', name: 'coconut tropical water palm milk' },
      { char: '🥝', name: 'kiwi fruit new zealand green tart' },
      { char: '🥑', name: 'avocado guacamole toast green superfood' },
      { char: '🥦', name: 'broccoli vegetable green healthy' },
      { char: '🌶️', name: 'hot pepper chili spicy seasoning heat' },
      { char: '🌽', name: 'ear of corn maize vegetable farm' },
      { char: '🥕', name: 'carrot vegetable orange rabbit healthy' },
      { char: '🍞', name: 'bread loaf toast bakery wheat' },
      { char: '🥐', name: 'croissant pastry french butter bakery' },
      { char: '🥖', name: 'baguette bread french bakery crusty' },
      { char: '🧀', name: 'cheese wedge swiss dairy yellow gouda' },
      { char: '🍳', name: 'cooking egg breakfast frying pan sunny side' },
      { char: '🥓', name: 'bacon meat breakfast crispy pork' },
      { char: '🥩', name: 'cut of meat steak beef beefy barbecue' },
      { char: '🍗', name: 'poultry leg chicken turkey drumstick fried' },
      { char: '🍖', name: 'meat on bone anime meat hunger barbecue' },
      { char: '🌭', name: 'hot dog frankfurter sausage street food bun' },
      { char: '🍔', name: 'hamburger burger fast food cheeseburger beef' },
      { char: '🍟', name: 'french fries chips fast food potato crispy' },
      { char: '🍕', name: 'pizza slice italian cheese pepperoni fast food' },
      { char: '🥪', name: 'sandwich lunch sub deli bread' },
      { char: '🌮', name: 'taco mexican street food shell meat salsa' },
      { char: '🌯', name: 'burrito wrap mexican food roll' },
      { char: '🥗', name: 'green salad healthy vegetables diet organic' },
      { char: '🍝', name: 'spaghetti pasta italian noodles sauce marinara' },
      { char: '🍜', name: 'steaming bowl ramen noodles soup broth asian' },
      { char: '🍣', name: 'sushi japanese fish raw rice roll sashimi' },
      { char: '🍱', name: 'bento box japanese lunch meal variety' },
      { char: '🥟', name: 'dumpling gyoza dim sum asian potsticker' },
      { char: '🍦', name: 'soft ice cream dessert dairy swirl cone sweet' },
      { char: '🍧', name: 'shaved ice dessert snow cone summer' },
      { char: '🍰', name: 'shortcake cake dessert strawberry sweet bakery slice' },
      { char: '🎂', name: 'birthday cake celebration party candles sweet' },
      { char: '🧁', name: 'cupcake muffin dessert sweet frosting bakery' },
      { char: '🥧', name: 'pie bakery dessert pastry apple berry' },
      { char: '🍫', name: 'chocolate bar sweet candy cocoa treat' },
      { char: '🍿', name: 'popcorn movie cinema theater snack corn buttery' },
      { char: '🍩', name: 'doughnut donut bakery sweet frosting sprinkles' },
      { char: '🍪', name: 'cookie chocolate chip bakery sweet dessert treat' },
      { char: '🥛', name: 'glass of milk dairy drink calcium healthy' },
      { char: '☕', name: 'hot beverage coffee tea cafe morning espresso caffeine' },
      { char: '🍵', name: 'teacup without handle green tea matcha japanese herbal' },
      { char: '🧃', name: 'beverage box juice box drink child sweet straw' },
      { char: '🥤', name: 'cup with straw soda drink soft drink beverage' },
      { char: '🧋', name: 'bubble tea boba tapioca drink sweet taiwan' },
      { char: '🍺', name: 'beer mug alcohol bar pub pint cold brew' },
      { char: '🍻', name: 'clinking beer mugs cheers toast pub celebrate party' },
      { char: '🥂', name: 'clinking glasses champagne toast celebration cheers wedding' },
      { char: '🍷', name: 'wine glass red wine alcohol drink winery vineyard' },
      { char: '🍸', name: 'cocktail glass martini drink bar alcohol olive' },
      { char: '🍹', name: 'tropical drink cocktail beach tiki fruity bar vacation' },
    ],
  },
  {
    id: 'activities',
    name: 'Activities & Sports',
    icon: '⚽',
    emojis: [
      { char: '⚽', name: 'soccer ball football match sport league fifa' },
      { char: '🏀', name: 'basketball sport nba hoop court game' },
      { char: '🏈', name: 'american football nfl sport ball gridiron touchdown' },
      { char: '⚾', name: 'baseball sport mlb pitch hit home run' },
      { char: '🥎', name: 'softball ball sport tournament pitch' },
      { char: '🎾', name: 'tennis ball sport court racket wimbledon' },
      { char: '🏐', name: 'volleyball sport beach court net spike' },
      { char: '🏉', name: 'rugby football sport scrum tackle' },
      { char: '🎱', name: 'pool 8 ball billiards cue game luck' },
      { char: '🏓', name: 'ping pong table tennis paddle ball sport match' },
      { char: '🏸', name: 'badminton racket shuttlecock bird sport court' },
      { char: '🏒', name: 'ice hockey puck stick nhl sport winter' },
      { char: '🥊', name: 'boxing glove punch fight boxer combat ring' },
      { char: '🥋', name: 'martial arts uniform karate judo taekwondo belt' },
      { char: '🛹', name: 'skateboard skate deck trick street skate' },
      { char: '🛼', name: 'roller skate skates rink retro roller derby' },
      { char: '🏋️', name: 'person lifting weights gym bodybuilding fitness deadlift workout' },
      { char: '🚴', name: 'person biking bicycle cycling bike ride race' },
      { char: '🏆', name: 'trophy winner champion award prize victory cup gold' },
      { char: '🥇', name: '1st place medal gold winner first first place' },
      { char: '🥈', name: '2nd place medal silver second runner up' },
      { char: '🥉', name: '3rd place medal bronze third place' },
      { char: '🏅', name: 'sports medal athletic award accomplishment ribbon' },
      { char: '🎖️', name: 'military medal honor service bravery award' },
      { char: '🎫', name: 'ticket admission concert event movie show pass' },
      { char: '🎟️', name: 'admission tickets raffle event movie pass' },
      { char: '🎪', name: 'circus tent big top carnival festival fair' },
      { char: '🎭', name: 'performing arts theater drama masks comedy tragedy acting' },
      { char: '🎨', name: 'artist palette paint art draw creative canvas colorful' },
      { char: '🎬', name: 'clapper board movie film cinema director production Hollywood' },
      { char: '🎤', name: 'microphone sing karaoke music vocal concert audio' },
      { char: '🎧', name: 'headphone audio music listen sound podcast beats' },
      { char: '🎼', name: 'musical score music sheet notes clef treble symphony' },
      { char: '🎹', name: 'musical keyboard piano keys instrument music melody' },
      { char: '🥁', name: 'drum instrument music percussion beat rock' },
      { char: '🎷', name: 'saxophone jazz instrument brass music blues' },
      { char: '🎺', name: 'trumpet brass horn instrument fanfare jazz fanfare' },
      { char: '🎸', name: 'guitar electric guitar rock music instrument chord acoustic' },
      { char: '🎻', name: 'violin string instrument orchestra classical music fiddle' },
      { char: '🎲', name: 'game die dice board game gambling roll luck tabletop' },
      { char: '♟️', name: 'chess pawn game strategy checkmate board tactical' },
      { char: '🎯', name: 'bullseye direct hit target darts accuracy goal aim precise' },
      { char: '🎳', name: 'bowling strike alley ball pins game' },
      { char: '🎮', name: 'video game controller joystick gamepad play station xbox gamer gaming' },
      { char: '🎰', name: 'slot machine casino jackpot gamble luck lucky seven' },
      { char: '🧩', name: 'puzzle piece jigsaw game solve mystery missing piece' },
    ],
  },
  {
    id: 'objects',
    name: 'Objects & Symbols',
    icon: '💡',
    emojis: [
      { char: '💡', name: 'light bulb idea bright brainstorm electricity innovation solution' },
      { char: '🔦', name: 'flashlight torch dark light beam illumination' },
      { char: '🏮', name: 'red paper lantern festival light celebration asian' },
      { char: '🧱', name: 'brick wall building construction masonry solid' },
      { char: '🪑', name: 'chair seat furniture sit rest wooden' },
      { char: '🚪', name: 'door entrance exit open house room entryway' },
      { char: '🧳', name: 'luggage suitcase travel baggage trip vacation pack' },
      { char: '🌂', name: 'closed umbrella rain weather storm gear' },
      { char: '☂️', name: 'umbrella rain weather storm protection dry' },
      { char: '🎈', name: 'balloon birthday party celebration helium festive float' },
      { char: '🎉', name: 'party popper celebrate celebration confetti congrats congratulations party win hooray' },
      { char: '🎊', name: 'confetti ball celebration festive party surprise victory' },
      { char: '🎁', name: 'wrapped gift present birthday surprise christmas holiday box' },
      { char: '🎀', name: 'ribbon bow decoration gift cute pink tie' },
      { char: '🔮', name: 'crystal ball fortune teller future magic psychic mystery oracle' },
      { char: '📱', name: 'mobile phone smartphone cell iphone android call message screen' },
      { char: '💻', name: 'laptop personal computer tech macbook coding programming work pc' },
      { char: '🖥️', name: 'desktop computer monitor screen pc display workstation tech' },
      { char: '🖨️', name: 'printer paper office print documents output tech' },
      { char: '⌨️', name: 'keyboard typing computer tech mechanical input keys' },
      { char: '🖱️', name: 'computer mouse click pointer tech hardware input' },
      { char: '🕹️', name: 'joystick arcade retro game gaming controller retro' },
      { char: '💾', name: 'floppy disk retro save storage memory tech 90s' },
      { char: '💿', name: 'optical disk cd dvd music media software album' },
      { char: '📷', name: 'camera photo picture snapshot capture photography shutter' },
      { char: '📸', name: 'camera with flash flash photo picture snapshot paparazzi' },
      { char: '📹', name: 'video camera film recorder camcorder cam recording movie' },
      { char: '🎥', name: 'movie camera film cinema hollywood recording motion picture' },
      { char: '📽️', name: 'film projector movie cinema theater screening vintage' },
      { char: '📞', name: 'telephone receiver call phone ring talk contact hotline' },
      { char: '☎️', name: 'telephone landline rotary phone call red hotline vintage' },
      { char: '📟', name: 'pager beeper 90s retro communication message tech' },
      { char: '📺', name: 'television tv screen show broadcast retro stream display' },
      { char: '📻', name: 'radio broadcast fm am tune music podcast vintage' },
      { char: '🎙️', name: 'studio microphone podcast recording audio radio vocal broadcast' },
      { char: '⏰', name: 'alarm clock time wake up morning ringing early alert' },
      { char: '⏱️', name: 'stopwatch timer measure speed lap race track seconds' },
      { char: '⏳', name: 'hourglass not done time sand countdown waiting passing patience' },
      { char: '⌛', name: 'hourglass done time sand timer deadline patience finished' },
      { char: '🔋', name: 'battery power energy charge electric level full juice' },
      { char: '🔌', name: 'electric plug power outlet cord electricity connect adapter' },
      { char: '💸', name: 'money with wings flying away dollar cash spend rich lose debt' },
      { char: '💵', name: 'dollar banknote cash currency paper money payment usd bill' },
      { char: '💰', name: 'money bag rich wealth gold treasure sack cash cash money' },
      { char: '💳', name: 'credit card payment swipe debit bank visa mastercard chip' },
      { char: '💎', name: 'gem stone diamond jewelry precious jewel valuable rich shine' },
      { char: '🔧', name: 'wrench tool mechanic fix repair hardware adjust spanner' },
      { char: '🔨', name: 'hammer tool build construction hit smash nail hardware' },
      { char: '⚒️', name: 'hammer and pick tools mining construction craft craft work' },
      { char: '🛠️', name: 'hammer and wrench tools fix repair customize maintenance settings' },
      { char: '⛏️', name: 'pick mining tool ore excavate stone craft rock' },
      { char: '🪓', name: 'axe chop wood lumberjack lumber tree sharp tool' },
      { char: '🔩', name: 'nut and bolt screw hardware construction mechanical fasten metal' },
      { char: '⚙️', name: 'gear cog settings options mechanical machine engine automation' },
      { char: '🔒', name: 'locked padlock security safe privacy secure secret protection e2ee' },
      { char: '🔓', name: 'unlocked padlock open accessible unsecured insecure available' },
      { char: '🔑', name: 'key unlock password secret access door security login credentials' },
      { char: '🗝️', name: 'old key antique vintage secret mystery access unlock dungeon' },
      { char: '✏️', name: 'pencil write draw sketch draft note edit lead graphite' },
      { char: '✒️', name: 'black nib fountain pen ink write signature calligraphy fancy' },
      { char: '📝', name: 'memo paper note write pad pencil document text list' },
      { char: '💼', name: 'briefcase work job business portfolio office professional case' },
      { char: '📁', name: 'file folder directory organize office documents storage archive' },
      { char: '📅', name: 'calendar date day schedule month agenda appointment timetable' },
      { char: '📌', name: 'pushpin pin map tack board note notice location sticky' },
      { char: '📎', name: 'paperclip attach clip attachment office documents link binder' },
      { char: '✂️', name: 'scissors cut snip shear trim tool sharp paper craft' },
      { char: '❤️', name: 'red heart love romance passion favorite affection heart' },
      { char: '🧡', name: 'orange heart love warmth friendship orange' },
      { char: '💛', name: 'yellow heart friendship yellow loyalty sunny' },
      { char: '💚', name: 'green heart nature organic green healthy envy' },
      { char: '💙', name: 'blue heart peace trust loyalty blue chill calm' },
      { char: '💜', name: 'purple heart royalty magic love purple honor compassion' },
      { char: '🖤', name: 'black heart dark gothic emo black sorrow mystery' },
      { char: '🤍', name: 'white heart pure clean peace white sincere innocent' },
      { char: '🤎', name: 'brown heart chocolate earth brown neutral comfort warm' },
      { char: '💔', name: 'broken heart heartbreak break up sad grief heartache pain hurt' },
      { char: '❣️', name: 'heart exclamation love punctuation mark alert emphasis' },
      { char: '💕', name: 'two hearts love floating affection sweetheart cute' },
      { char: '💞', name: 'revolving hearts love romance in love sweet couple' },
      { char: '💓', name: 'beating heart pulse heartbeat alive passion love dynamic' },
      { char: '💗', name: 'growing heart love expanding affection blush excited' },
      { char: '💖', name: 'sparkling heart glitter shine love cute special beloved' },
      { char: '💘', name: 'heart with arrow cupid love romance arrow crush' },
      { char: '💝', name: 'heart with ribbon gift love valentine present surprise package' },
      { char: '💯', name: 'hundred points score perfect 100 exam test real authentic pure' },
      { char: '💢', name: 'anger symbol anime comic angry mad pop frustration vein' },
      { char: '💬', name: 'speech balloon bubble talk chat message conversation text SMS' },
      { char: '💭', name: 'thought balloon bubble think dream ponder reflect idea cloudy' },
      { char: '💤', name: 'zzz sleeping sleep tired snore boring nap dream bedtime' },
      { char: '⭕', name: 'heavy large circle red o ring correct mark ok circle' },
      { char: '✅', name: 'check mark button check correct approved done success pass' },
      { char: '❌', name: 'cross mark x wrong incorrect cancel delete reject error no' },
      { char: '⚠️', name: 'warning alert caution hazard danger notice exclamation yellow' },
      { char: '⛔', name: 'no entry stop sign forbidden banned access prohibited red' },
      { char: '🚫', name: 'prohibited no sign ban restricted denied forbidden cancel' },
      { char: '🚀', name: 'rocket space launch ship blastoff fast speed moon explore' },
    ],
  },
];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeTab, setActiveTab] = useState<string>(EMOJI_CATEGORIES[0].id);
  const [search, setSearch] = useState<string>('');
  const [hoveredName, setHoveredName] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    const matches: Array<{ char: string; name: string }> = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (item.name.toLowerCase().includes(q)) {
          matches.push(item);
        }
      }
    }
    return matches;
  }, [search]);

  const scrollToCategory = (categoryId: string) => {
    setActiveTab(categoryId);
    setSearch('');
    const el = document.getElementById(`cat-heading-${categoryId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={styles.pickerContainer}>
      {/* Search Header */}
      <div className={styles.searchHeader}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search all emojis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Icons Nav (hidden during search) */}
      {!search.trim() && (
        <div className={styles.categoryNav}>
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`${styles.categoryBtn} ${activeTab === cat.id ? styles.categoryBtnActive : ''}`}
              onClick={() => scrollToCategory(cat.id)}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Grid Content */}
      <div className={styles.emojiGridWrapper} ref={contentRef}>
        {filteredResults !== null ? (
          <div>
            <div className={styles.categoryTitle}>
              Search Results ({filteredResults.length})
            </div>
            {filteredResults.length === 0 ? (
              <div className={styles.emptySearch}>
                <span>😕</span>
                <span>No emojis matching &ldquo;{search}&rdquo;</span>
              </div>
            ) : (
              <div className={styles.emojiGrid}>
                {filteredResults.map((item, idx) => (
                  <button
                    key={`${item.char}-${idx}`}
                    className={styles.emojiItem}
                    onClick={() => onSelect(item.char)}
                    onMouseEnter={() => setHoveredName(item.name.split(' ')[0] || item.name)}
                    onMouseLeave={() => setHoveredName('')}
                    title={item.name}
                  >
                    {item.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.id} id={`cat-heading-${cat.id}`}>
              <div className={styles.categoryTitle}>{cat.name}</div>
              <div className={styles.emojiGrid}>
                {cat.emojis.map((item, idx) => (
                  <button
                    key={`${item.char}-${idx}`}
                    className={styles.emojiItem}
                    onClick={() => onSelect(item.char)}
                    onMouseEnter={() => setHoveredName(item.name.split(' ')[0] || item.name)}
                    onMouseLeave={() => setHoveredName('')}
                    title={item.name}
                  >
                    {item.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Tooltip Preview */}
      <div className={styles.footerBar}>
        <span style={{ textTransform: 'capitalize' }}>
          {hoveredName ? `:${hoveredName}:` : 'Click to insert emoji'}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#80848e',
            cursor: 'pointer',
            fontSize: '11px',
          }}
        >
          ESC to close
        </button>
      </div>
    </div>
  );
}
