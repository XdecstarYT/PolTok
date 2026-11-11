# Kokoro neural TTS for the reel engine: reads text on stdin, writes a WAV.
# usage: kokoro_say.py <model_dir> <voice> <speed> <out.wav> [lang]
# <model_dir> holds kokoro-v1.0.onnx + voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx releases).
# Pronunciation overrides: write [Te Pāti Māori](/tˈɛ pˈɑːti mˈɑːoɹi/) and the IPA between slashes is spoken.
import re, sys
import soundfile as sf
from kokoro_onnx import Kokoro

d, voice, speed, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
lang = sys.argv[5] if len(sys.argv) > 5 else 'en-us'
k = Kokoro(d + '/kokoro-v1.0.onnx', d + '/voices-v1.0.bin')
text = sys.stdin.read().strip()

parts, pos = [], 0
for m in re.finditer(r'\[([^\]]+)\]\(/([^/]+)/\)', text):
    if m.start() > pos:
        parts.append(k.tokenizer.phonemize(text[pos:m.start()], lang))
    parts.append(m.group(2))
    pos = m.end()
if pos < len(text):
    parts.append(k.tokenizer.phonemize(text[pos:], lang))
ph = ' '.join(p.strip() for p in parts if p.strip())

samples, sr = k.create(ph, voice=voice, speed=speed, lang=lang, is_phonemes=True)
sf.write(out, samples, sr)
