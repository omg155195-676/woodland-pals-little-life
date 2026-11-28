# 成年型動作圖（睡覺／生病…）去背並縮放：高度＝成年 idle 高 ×（幼年同動作高 ÷ 幼年 idle 高）
# 讓成年的睡姿和幼年睡姿與站姿的比例一致。
# 用法：python3 -I tools/adultpose.py <動作> <型態> <來源截圖>
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from cutout import cutout
from PIL import Image
act, form, src = sys.argv[1:4]
ch = form.split('_')[0]
A = lambda f, a: Image.open(f'assets/characters/{f}/act/{f}_act_{a}.webp')
ratio = A(ch, act).height / A(ch, 'idle').height
h = round(A(form, 'idle').height * ratio)
spr = cutout(src); w = round(spr.width * h / spr.height)
out = f'assets/characters/{form}/act/{form}_act_{act}.webp'
spr.resize((w, h), Image.LANCZOS).save(out, 'WEBP', quality=92, method=6)
print(out, (w, h))
