# 森林寶寶的新動作圖：把橡實帽顏色對齊定稿 idle（ChatGPT 後來畫的帽子偏淺焦糖色）
# 用法：python3 -I tools/capmatch.py <idle.webp> <要調的圖.webp>...（直接覆蓋）
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
def capmask(a):
    r, g, b, al = [a[..., i].astype(float) for i in range(4)]
    m = (al > 128) & (r - b > 45) & (r - g > 25) & (r > 125)         # 棕橘色系（不含深色外框線）
    m &= ~((g > b + 40) & (g > r * .75))                               # 排除綠葉
    lab, n = ndimage.label(m); s = ndimage.sum(m, lab, range(1, n + 1))
    big = lab == (int(np.argmax(s)) + 1)                                # 帽子是最大的一塊
    y0, y1 = np.nonzero(big.any(1))[0][[0, -1]]; x0, x1 = np.nonzero(big.any(0))[0][[0, -1]]
    box = np.zeros_like(m); box[y0:y1 + 1, x0:x1 + 1] = True
    hull = ndimage.binary_fill_holes(ndimage.binary_closing(big, iterations=4))
    return m & box & hull                                               # 帽子範圍內的棕橘色（花紋線也算），腮紅不在裡面
def stats(px): return px.mean(0), px.std(0) + 1e-3
ref = np.asarray(Image.open(sys.argv[1]).convert('RGBA'))
mr, sr = stats(ref[capmask(ref)][:, :3].astype(float))
for p in sys.argv[2:]:
    a = np.asarray(Image.open(p).convert('RGBA')).copy(); m = capmask(a)
    px = a[m][:, :3].astype(float); mt, st = stats(px)
    k = np.clip(sr / st, .6, 1.4)
    a[..., :3][m] = np.clip((px - mt) * k + mr, 0, 255).astype(np.uint8)
    Image.fromarray(a, 'RGBA').save(p, 'WEBP', quality=92, method=6); print(p, mt.round(), '→', mr.round())
