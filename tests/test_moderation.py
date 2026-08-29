from securechat.moderation.classifier import ModerationClassifier


def test_moderation_blocks_obvious_toxic_text() -> None:
    classifier = ModerationClassifier(threshold=0.2)
    result = classifier.moderate("you are stupid")
    assert not result.allowed
