import json, pathlib, html
# Regenerate design-only SVG/JSON assets; does not edit application code.
root=pathlib.Path(__file__).resolve().parents[3]
spec=json.loads((root/'src/data/companion-spec.json').read_text())
out=root/'docs/plans/assets'
(out/'scene-storyboards').mkdir(exist_ok=True)
styles='''
.sb-art { --sb-blue:color-mix(in srgb,var(--blue) 86%,var(--background)); --sb-pale:color-mix(in srgb,var(--blue) 22%,var(--background)); --sb-shade:color-mix(in srgb,var(--blue) 82%,var(--foreground)); --sb-line:color-mix(in srgb,var(--blue) 48%,var(--foreground)); --sb-ink:var(--foreground); --sb-wood:color-mix(in srgb,var(--orange) 22%,var(--background)); --sb-wood-edge:color-mix(in srgb,var(--orange) 38%,var(--background)); --sb-green:color-mix(in srgb,var(--green) 50%,var(--background)); --sb-paper:color-mix(in srgb,var(--background) 88%,var(--foreground)); --sb-pink:color-mix(in srgb,var(--orange) 48%,var(--background)); --sb-water:color-mix(in srgb,var(--blue) 35%,var(--background)); stroke-linecap:round;stroke-linejoin:round; }
.sb-art .sb-body {fill:var(--sb-blue);stroke:var(--sb-line);stroke-width:1.5}
.sb-art .sb-belly {fill:var(--sb-pale)}
.sb-art .sb-shade {fill:var(--sb-shade);stroke:var(--sb-line);stroke-width:1.5}
.sb-art .sb-line {fill:none;stroke:var(--sb-line);stroke-width:1.6}
.sb-art .sb-softline {fill:none;stroke:var(--sb-line);stroke-width:1.2;opacity:.6}
.sb-art .sb-ink {fill:var(--sb-ink)}
.sb-art .sb-face {fill:none;stroke:var(--sb-ink);stroke-width:2.4}
.sb-art .sb-pink {fill:var(--sb-pink)}
.sb-art .sb-shadow {fill:var(--sb-line);opacity:.12}
.sb-art .sb-table {fill:var(--sb-wood);stroke:var(--sb-line);stroke-width:1.5}
.sb-art .sb-edge {fill:var(--sb-wood-edge);stroke:var(--sb-line);stroke-width:1.5}
.sb-art .sb-green {fill:var(--sb-green);stroke:var(--sb-line);stroke-width:1.5}
.sb-art .sb-paper {fill:var(--sb-paper);stroke:var(--sb-line);stroke-width:1.5}
.sb-art .sb-water {fill:var(--sb-water);stroke:var(--sb-line);stroke-width:1.4}
.sb-art .sb-steam {fill:none;stroke:var(--sb-line);stroke-width:2.1;opacity:.65}
.sb-art .sb-light {fill:var(--sb-pale);stroke:var(--sb-line);stroke-width:1.4}
'''.strip()
def path(d,c='sb-line',extra=''):return f'<path class="{c}" d="{d}" {extra}/>'
def ellipse(x,y,rx,ry,c='sb-shadow',extra=''):return f'<ellipse class="{c}" cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" {extra}/>'
def rect(x,y,w,h,c='sb-paper',r=3,extra=''):return f'<rect class="{c}" x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" {extra}/>'
def g(s,t=''):return f'<g transform="{t}">{s}</g>' if t else f'<g>{s}</g>'
def ground():return ellipse(160,220,137,10)+path('M28 220 Q160 235 294 220','sb-softline')
def part(n,c):return path(spec['parts'][n]['d'],c)
def actor(x=42,y=38,eyes='open',gaze=0,lean=0,gazeY=0):
    s=ellipse(120,169,54,5)+' '.join(part(n,c) for n,c in [('footLeft','sb-shade'),('footRight','sb-shade'),('tuft','sb-body'),('body','sb-body'),('shine','sb-belly'),('belly','sb-belly'),('cheekLeft','sb-pink'),('cheekRight','sb-pink')])
    if eyes=='open': s+=g(part('eyeLeft','sb-ink')+part('eyeRight','sb-ink'),f'translate({gaze} {gazeY})')
    elif eyes=='happy':s+=part('eyesHappy','sb-face')
    else:s+=part('eyesResting','sb-face')
    s+=part('mouth','sb-face')
    return g(s,f'translate({x} {y}) rotate({lean} 120 160)')
def rest_arm(side,x=42,y=38,lean=0):
    """Original short relaxed silhouette, attached in the actor's coordinates."""
    name='armLeftPaused' if side in ('left','l') else 'armRightPaused'
    return g(part(name,'sb-body'),f'translate({x} {y}) rotate({lean} 120 160)')
def rest_arms(x=42,y=38,lean=0):
    return rest_arm('left',x,y,lean)+rest_arm('right',x,y,lean)
def table():
    return (path('M55 185 L54 220 Q59 224 65 220 L70 187 M248 187 L254 220 Q260 224 266 220 L265 185','sb-edge')+
       path('M35 180 L35 187 Q159 210 285 187 L285 180','sb-edge')+ellipse(160,180,125,17,'sb-table')+path('M47 181 Q159 200 274 181','sb-softline'))
def mat(kind='warm'):
    return path('M59 196 Q160 184 267 199 L285 217 Q154 238 37 218 Z','sb-light' if kind=='blue' else 'sb-table')+path('M55 217 Q160 231 271 215','sb-softline')
def cushion():return path('M103 191 Q86 182 91 206 Q151 231 230 209 Q244 191 224 188 Q165 204 103 191Z','sb-light')+path('M106 209 Q165 218 219 207','sb-softline')
def saucer(x,y):return ellipse(x,y,22,4,'sb-paper')
def cup(x,y,scale=1):
    return g(path('M20 -18 C37 -21 38 -3 21 -4 L21 -9 C31 -7 31 -17 21 -14','sb-paper')+path('M-18 -21 L23 -21 L20 -3 Q1 7 -14 -3 Z','sb-paper')+ellipse(2,-21,20,4,'sb-edge'),f'translate({x} {y}) scale({scale})')
def kettle(x=78,y=178,tilt=0):
    return g(ellipse(0,2,31,4)+path('M20 -37 C55 -43 55 -10 27 -12 L27 -18 C43 -16 44 -35 24 -31 Z','sb-green')+path('M-20 -25 L-43 -45 L-45 -52 L-17 -35 Z','sb-green')+path('M-20 -43 Q-32 -27 -26 -5 Q0 10 29 -4 Q35 -26 23 -43 Z','sb-green')+path('M-24 -43 Q0 -58 26 -43Z','sb-green')+path('M-5 -51 Q-7 -60 6 -60 Q11 -56 7 -51Z','sb-green'),f'translate({x} {y}) rotate({tilt})')
def steam(x,y,stage=1):
    curves=['M0 0 C12 -9 -9 -17 1 -28','M13 0 C27 -13 3 -22 15 -37','M-12 1 C0 -12 -22 -23 -9 -43']
    return g(''.join(path(d,'sb-steam',f'opacity="{.28+.18*stage}"') for d in curves[:max(0,min(stage,3))]),f'translate({x} {y})')
def small_table():return path('M244 184 L244 220 M288 184 L288 218','sb-line')+ellipse(266,184,32,10,'sb-table')

def tea_table():
    # A side table, approximately half the former full-width tabletop.
    return (path('M37 188 L39 220 Q43 223 48 219 L50 190 M141 190 L147 219 Q151 223 156 219 L153 188','sb-edge')+
            path('M25 184 L25 189 Q94 205 165 189 L165 184','sb-edge')+
            ellipse(95,184,70,13,'sb-table'))

def tea(s):
    # Dedicated short arm silhouettes. The generic endpoint arm helper makes
    # rigid tubes here and is deliberately not used for this reviewed pose.
    a=ground()+actor(x=90,y=45,eyes='happy' if s==3 else 'open',gaze=-3 if s in [1,2] else 0)
    left_rest=g(part('armLeftPaused','sb-body'),'translate(90 45)')
    right_rest=g(part('armRightPaused','sb-body'),'translate(90 45)')
    if s<2:a+=left_rest+right_rest
    elif s==2:a+=right_rest
    a+=tea_table()+ellipse(72,182,26,4,'sb-edge')+g(saucer(0,0),'translate(137 183) scale(.78)')
    a+=g(kettle(0,0),'translate(72 179) scale(.72)')
    a+=steam(71,135,[1,2,3,1][s])
    if s<3:
        a+=cup(137,180,.64)
        if s==2:
            # Shoulder -> rounded elbow -> mitten at the near cup handle.
            a+=path('M159 148 C151 147 149 154 150 161 C150 168 154 174 159 175 C165 176 168 171 164 168 C160 166 159 162 161 158 C164 153 165 150 159 148 Z','sb-body')
            a+=path('M157 167 Q160 165 162 168','sb-softline')
    else:
        # The cup comes close to the torso: one palm supports the base and
        # the other meets the handle. Its silhouette overlaps both forearms.
        a+=path('M160 149 C151 150 154 167 165 177 C173 185 187 186 196 180 C200 177 198 171 193 171 C187 173 178 171 173 166 C168 160 170 150 160 149 Z','sb-body')
        a+=path('M259 150 C269 153 265 169 253 178 C246 183 237 180 231 174 C228 171 230 165 235 164 C241 166 246 165 249 160 C251 154 253 149 259 150 Z','sb-body')
        a+=cup(204,174,.82)+steam(204,151,1)
        a+=path('M231 167 C227 164 224 167 226 171 C228 174 233 174 235 172','sb-body')
    return a

def pot(x=81,y=178,lid=True):
    z=ellipse(x,y+1,36,5,'sb-edge')
    z+=g(path('M-29 -22 Q-45 -29 -42 -16 L-30 -12 M29 -22 Q45 -29 42 -16 L31 -12','sb-line')+path('M-32 -33 L33 -33 L29 -4 Q0 7 -28 -4Z','sb-green')+ellipse(0,-32,32,7,'sb-edge'),f'translate({x} {y})')
    if lid:z+=g(path('M-35 -35 Q0 -60 35 -35 Z','sb-green')+rect(-6,-54,12,7,'sb-edge',4),f'translate({x} {y})')
    return z

def craft_press_left():
    # A relaxed shoulder, rounded elbow and broad palm resting on a work surface.
    return path('M111 141 C102 141 103 158 116 170 C124 179 136 181 143 175 C147 171 143 166 139 166 C132 168 124 164 120 157 C117 150 120 141 111 141 Z','sb-body')


def craft_press_right():
    return g(craft_press_left(),'translate(324 0) scale(-1 1)')


def craft_page_hand(bookmark=False):
    # The shoulder stays fixed while the rounded palm follows the page/ribbon.
    if bookmark:
        return path('M213 143 C224 146 222 161 213 170 C205 174 194 164 184 156 C179 152 180 146 185 145 C191 146 198 155 204 156 C210 157 205 141 213 143 Z','sb-body')
    return path('M213 143 C223 146 222 158 213 165 C205 169 194 159 184 151 C179 147 180 141 185 140 C191 141 198 150 204 151 C210 152 205 141 213 143 Z','sb-body')


def food_dish(x,y,kind,prepared=False):
    # Three recognisable dishes, each visibly supported on its own plate/bowl.
    z=ellipse(0,1,25,4)
    if kind=='rice':
        z+=ellipse(0,-1,30,7,'sb-paper')+ellipse(0,-2,24,4,'sb-edge')
        if prepared:
            z+=path('M-20 -5 Q-19 -14 -11 -15 Q-8 -23 0 -20 Q10 -24 13 -15 Q21 -13 21 -5 Z','sb-paper')
            z+=path('M-10 -11 l3 1 m4 -6 l3 1 m6 5 l3 -1 m-12 5 l3 1','sb-softline')
            z+=path('M-4 -20 Q-8 -28 2 -26 Q6 -23 3 -19 Z','sb-green')
        else:
            z+=ellipse(-9,-7,7,3,'sb-paper')+ellipse(5,-7,9,3,'sb-paper')
    else:
        z+=path('M-24 -12 L24 -12 Q21 4 0 5 Q-21 4 -24 -12 Z','sb-paper')+ellipse(0,-12,24,6,'sb-paper')
        if kind=='greens':
            z+=path('M-18 -13 Q-24 -25 -13 -24 Q-12 -33 -4 -25 Q5 -33 9 -23 Q20 -26 20 -16 Q9 -8 -18 -13 Z','sb-green')
            z+=path('M-10 -23 L-5 -14 M8 -24 L6 -14','sb-softline')
            if prepared:
                z+=ellipse(-11,-13,5,4,'sb-pink')+ellipse(10,-16,5,4,'sb-pink')
        elif prepared:
            z+=ellipse(0,-12,21,4.5,'sb-edge')
            z+=ellipse(-7,-13,4,2,'sb-green')+ellipse(7,-11,3,1.8,'sb-green')
    return g(z,f'translate({x} {y})')

def food(s):
    z=ground()+actor(eyes='happy' if s==3 else 'open',gaze=-2 if s==1 else 0)
    z+=rest_arm('right')
    if s in (0,3):z+=rest_arm('left')
    z+=table()
    z+=food_dish(100,177,'greens',s>=1)
    z+=food_dish(162,188,'rice',s>=2)
    z+=food_dish(225,177,'soup',s>=3)
    # A small utensil rest, not a large lid-shaped object at the right edge.
    z+=rect(241,188,21,5,'sb-edge',2)
    if s in (0,3):
        z+=path('M238 190 L260 189','sb-line')+ellipse(263,189,5,2.5,'sb-paper')
    elif s==1:
        # Spoon is held in a compact curved left arm, close to its shoulder.
        z+=path('M102 160 L128 146','sb-line')+ellipse(100,161,6,3,'sb-paper')
        z+=path('M110 141 C102 141 100 150 105 158 C110 166 120 165 128 158 C132 154 132 148 127 147 C122 147 120 153 116 153 C114 150 119 143 110 141 Z','sb-body')
        z+=path('M126 150 L129 148','sb-softline')
    else:
        z+=path('M135 160 L160 174','sb-line')+ellipse(164,175,7,3,'sb-paper')
        z+=path('M110 141 C101 142 103 156 112 166 C119 174 131 174 139 168 C144 164 141 158 136 158 C130 161 125 160 121 156 C118 151 119 142 110 141 Z','sb-body')
        z+=path('M135 161 L138 163','sb-softline')
    if s==3:z+=steam(225,157,1)
    return z

def plant(s):
    # Bring the pot inside a short arm's reach; the shoulder never stretches.
    z=ground()+actor(gaze=-3,eyes='happy' if s==3 else 'open')+table()+ellipse(92,180,32,5,'sb-edge')
    z+=rest_arm('right')
    if s in [0,2]:z+=rest_arm('left')
    z+=g(path('M-24 -33 L24 -33 L18 -3 Q0 5 -18 -3Z','sb-table')+ellipse(0,-33,26,6,'sb-edge')+ellipse(0,-33,21,3,'sb-shadow'),'translate(92 177)')
    h=[13,28,43,55][s]
    z+=path(f'M92 143 Q95 {141-h/2} 91 {143-h}','sb-line')
    z+=path(f'M92 {139-h*.3} Q67 {134-h*.7} 70 {128-h*.7} Q91 {125-h*.5} 92 {139-h*.3} Z','sb-green')
    z+=path(f'M92 {135-h*.6} Q113 {127-h} 118 {132-h} Q116 {147-h*.5} 92 {135-h*.6} Z','sb-green')
    if s==2:z+=ellipse(91,98,8,11,'sb-pink')
    if s==3:z+=''.join(ellipse(91+dx,88+dy,8,9,'sb-pink') for dx,dy in [(-9,0),(9,0),(0,-9),(0,9)])+ellipse(91,88,5,5,'sb-edge')
    if s in [1,3]:
        # Near palm overlaps the pot wall directly below its rim.
        z+=path('M111 141 C103 140 101 147 102 154 C102 161 106 167 111 168 C117 169 120 164 116 161 C112 159 111 155 113 151 C116 146 117 143 111 141 Z','sb-body')
    return z


def book_shape(s):
    if s==3:return path('M125 149 L190 149 L190 178 L125 178Z','sb-green')+path('M129 173 L187 173','sb-paper')+path('M179 175 L179 184 L174 181 L169 184 L169 175','sb-pink')
    z=path('M159 165 Q133 150 112 157 L115 180 Q140 175 160 188 Q179 174 206 178 L208 154 Q184 150 159 165Z','sb-paper')+path('M160 165 L160 187','sb-line')
    for j in range(3):z+=path(f'M122 {164+j*4} Q141 {160+j*4} 153 {171+j*4} M167 {171+j*4} Q183 {161+j*4} 198 {162+j*4}','sb-softline')
    if s==1:z+=path('M160 165 Q177 146 185 140 Q183 164 160 186Z','sb-paper')
    if s==2:z+=path('M185 153 L185 175 L181 172 L177 175 L177 154','sb-pink')
    return z

def book(s):
    z=ground()+actor(eyes='happy' if s==3 else 'open')+table()
    if s==3:
        # Book is supported on the table, with both short hands at its sides.
        z+=craft_press_left()+craft_press_right()+book_shape(s)
    else:
        z+=book_shape(s)+craft_press_left()
        if s==0:z+=craft_press_right()
        elif s==1:z+=craft_page_hand()
        else:
            # Bookmark comes to the hand rather than asking the arm to reach far.
            z+=craft_page_hand(bookmark=True)
    return z


def bubbles(s):
    z=ground()+mat()+actor(eyes='happy' if s==3 else 'open')+rest_arm('left')
    z+=ellipse(242,212,21,4)+rect(226,178,32,33,'sb-green',7)+ellipse(242,180,16,5,'sb-edge')
    if s==0:
        z+=path('M242 155 L242 187','sb-line')+ellipse(242,193,9,10,'sb-line')
        z+=path('M213 141 C223 140 226 151 230 157 C234 161 240 159 245 160 C252 162 249 169 244 171 C233 177 223 171 217 164 C209 157 206 146 213 141 Z','sb-body')
    else:
        z+=path('M236 141 L236 113','sb-line')+ellipse(236,108,11,12,'sb-line')
        z+=path('M213 143 C224 146 230 142 232 134 C233 129 238 127 241 131 C246 137 242 148 234 154 C224 161 214 156 210 150 C207 146 209 141 213 143 Z','sb-body')
    spots=[[],[(262,90,16)],[(262,80,20),(69,91,14),(234,38,10)],[(265,69,25),(60,86,15)]]
    for x,y,r in spots[s]:z+=ellipse(x,y,r,r,'sb-water',extra='opacity=".58"')+path(f'M{x-r*.6} {y-r*.2} Q{x-r*.6} {y-r*.65} {x-r*.2} {y-r*.7}','sb-paper')
    if s==3:z+=path('M265 66 C250 52 244 72 265 82 C286 72 280 52 265 66Z','sb-pink')
    return z


def boat(s):
    z=ground()+actor(eyes='happy' if s==3 else 'open')+table()
    if s==0:z+=path('M112 169 L173 157 L210 178 L146 191Z','sb-paper')+path('M134 167 L190 180','sb-softline')
    if s==1:z+=path('M120 179 L164 145 L205 179Z','sb-paper')+path('M164 145 L164 179','sb-line')
    if s==2:z+=path('M119 177 L164 155 L208 177 L189 188 L138 188Z','sb-paper')+path('M119 177 L164 181 L208 177 M164 155 L164 181','sb-line')
    if s<3:z+=craft_press_left()+craft_press_right()
    else:
        z+=rest_arms()
        z+=ellipse(166,183,65,11,'sb-edge')+ellipse(166,180,62,10,'sb-water')+path('M129 173 L199 173 L183 185 L145 185Z','sb-paper')+path('M145 172 L164 148 L183 172Z','sb-paper')+path('M164 150 L164 173','sb-softline')+path('M116 185 Q130 188 140 186 M192 187 L210 184','sb-softline')
    return z


def block(x,y,c='sb-green'):return path(f'M{x} {y-22} L{x+25} {y-22} L{x+25} {y} L{x} {y}Z',c)+path(f'M{x} {y-22} L{x+7} {y-28} L{x+31} {y-28} L{x+25} {y-22} M{x+25} {y-22} L{x+31} {y-28} L{x+31} {y-6} L{x+25} {y}','sb-line')
def blocks(s):
    # Move the tower close to the body. Each action is a short placement, not a reach.
    z=ground()+mat()+actor(eyes='happy' if s==3 else 'open',gaze=-3)+rest_arm('right')
    z+=block(88,211,'sb-green')+block(117,211,'sb-table')
    if s>=1:z+=block(100,183,'sb-light')
    if s>=2:z+=block(100,155,'sb-green')
    if s==0:
        z+=rest_arm('left')+block(240,211,'sb-light')
    elif s==1:
        z+=path('M111 141 C102 140 100 149 104 158 C108 166 118 169 125 165 C130 162 127 157 123 156 C116 157 114 152 115 148 C117 143 115 141 111 141 Z','sb-body')
        z+=block(240,211,'sb-light')
    elif s==2:
        z+=path('M110 140 C102 139 100 147 104 155 C109 160 119 157 124 151 C127 147 126 141 122 140 C119 141 116 145 113 144 C113 142 114 140 110 140 Z','sb-body')
        z+=block(240,211,'sb-light')
    else:
        z+=path('M110 127 L110 105','sb-line')+path('M110 105 L132 112 L110 118Z','sb-pink')
        # This is the settled pose after placement; keep the flag unobscured.
        z+=rest_arm('left')
    return z


def star(x,y,r=5):return path(f'M{x} {y-r} L{x+1.8} {y-1.5} L{x+r} {y} L{x+1.8} {y+1.5} L{x} {y+r} L{x-1.8} {y+1.5} L{x-r} {y} L{x-1.8} {y-1.5}Z','sb-edge')
def stars(s):
    # Body and relaxed arms share the same lean; shoulders never drift apart.
    lean = -5
    z = ground() + mat('blue') + cushion()
    z += actor(eyes='open' if s < 3 else 'happy', gaze=-2, gazeY=-3, lean=lean)
    z += rest_arms(lean=lean)
    z += path('M44 42 C19 49 28 75 49 70 C30 67 32 49 44 42Z', 'sb-paper')
    spots = [(260,44),(75,31),(285,105),(224,23),(36,116),(252,85)]
    for x,y in spots[:[2,3,5,6][s]]:
        z += star(x,y)
    if s > 0:
        z += path('M260 44 L252 85 L285 105', 'sb-softline')
    if s == 3:
        z += path('M211 32 L174 51 M214 37 L187 53', 'sb-softline') + star(216,31,7)
    return z


def stretch(s):
    lean = [0,-3,3,0][s]
    z = ground() + mat('blue') + actor(eyes='closed', lean=lean)
    if s in [0,3]:
        z += rest_arms(lean=lean)
    else:
        # Original short mitten arms rotate at their own shoulder anchors.
        # Apply the torso lean to both arms after their local shoulder turn.
        angle = 15 if s == 1 else -10
        left = g(part('armLeftHappy','sb-body'), f'rotate({angle} 68 104)')
        right = g(part('armRightHappy','sb-body'), f'rotate({-angle} 171 104)')
        z += g(left + right, f'translate(42 38) rotate({lean} 120 160)')
    return z


def cloud(x,y,w=1):return g(path('M-31 8 C-48 7 -44 -10 -31 -9 C-29 -31 -8 -30 -1 -15 C13 -24 29 -15 27 -2 C48 -5 47 13 31 13 L-29 13Z','sb-paper'),f'translate({x} {y}) scale({w})')
def clouds(s):
    lean = -5
    z = ground() + mat('blue') + cushion()
    z += actor(eyes='open' if s in [0,2] else 'closed', gaze=-2, lean=lean)
    z += rest_arms(lean=lean)
    z += cloud(53+s*9,58,.67) + cloud(252-s*6,91,.5)
    if s == 2:
        z += cloud(247,37,.34)
    return z


def drink(s):
    z = ground() + mat('blue') + cushion()
    z += actor(eyes='happy' if s == 3 else 'closed') + small_table() + saucer(266,183)
    # Three deliberately drawn close-to-body holds. Shoulder roots remain fixed
    # while the elbows curl inward a little more as the cup reaches the mouth.
    poses = [
        (
            175,
            'M112 142 C103 143 106 162 117 174 C125 183 138 185 148 180 C153 177 151 171 146 171 C138 173 129 168 125 162 C120 154 122 143 112 142 Z',
            'M211 143 C221 146 218 165 205 176 C199 181 189 181 183 175 C179 171 182 165 187 165 C193 167 199 164 201 158 C203 150 205 142 211 143 Z',
        ),
        (
            168,
            'M112 142 C103 143 106 160 117 170 C125 178 139 179 148 173 C152 170 150 164 145 164 C139 166 130 164 125 159 C120 153 122 143 112 142 Z',
            'M211 143 C221 146 217 162 205 171 C198 176 189 173 183 167 C180 164 182 158 187 157 C193 159 198 158 201 153 C203 147 205 142 211 143 Z',
        ),
        (
            162,
            'M112 142 C104 143 105 155 115 163 C123 171 138 171 148 166 C152 163 151 157 146 157 C139 159 131 156 126 151 C121 146 121 141 112 142 Z',
            'M211 143 C219 147 216 159 207 166 C199 172 189 169 183 163 C179 160 182 154 187 153 C193 155 199 153 201 148 C204 142 207 140 211 143 Z',
        ),
    ]
    cy,left,right = poses[s if s < 3 else 0]
    z += path(left,'sb-body') + path(right,'sb-body')
    # Left palm sits under the base; the cup overlaps the forearms. A small,
    # connected right mitten overlaps its handle rather than floating beside it.
    z += cup(156,cy,.82)
    z += path(f'M183 {cy-7} C179 {cy-10} 176 {cy-7} 178 {cy-3} C180 {cy} 185 {cy} 187 {cy-2}', 'sb-body')
    z += steam(155,cy-24,1)
    if s == 1:
        z += path('M163 147 Q154 145 150 150', 'sb-softline')
    return z


meta=[
('F1','Prepare a little meal','focus','Vegetables, a rice dish and soup share a compact preparation table.',['Lay out ingredients','Prepare the vegetables','Plate the rice','Three dishes ready'],['Three dishes have their places','A short, relaxed spoon grip','The main dish joins the table','Vegetables, rice and warm soup'],food,'food'),
('F2','Little plant','focus','The flowerpot rests in a tray on a low potting bench.',['Small shoot','Leaves unfold','A new bud','Flower opens'],['Pot stays in its tray','Hand steadies the pot','Bud grows above leaves','A gentle pot pat'],plant,'plant'),
('F3','Picture book','focus','An open book rests on a reading table while one hand supports each action.',['Open spread','Turn a page','Place ribbon','Close the book'],['Book rests on table','Fingers follow the corner','Ribbon marks the place','Book stays supported'],book,'book'),
('F4','A quiet cup of tea','focus','One cup on a small side table; short, relaxed arms reach only as far as the cup.',['Settle beside the table','Tea is warming','Take the cup','Enjoy the tea'],['Hands rest close to the body','One cup stays on its saucer','A small reach to the handle','Cup held close, base supported'],tea,'tea'),
('F5','Bubble play','focus','The soap jar stands on a floor mat; the wand moves from the jar into open air.',['Dip the wand','One small bubble','Bubbles drift','A heart bubble'],['Jar anchored on mat','Short grip on the handle','Clear space for bubbles','A playful final shape'],bubbles,'bubbles'),
('F6','Paper boat','focus','Paper folds on a craft table; the finished boat rests in a shallow water tray.',['Lay out paper','Press a crease','Open the hull','Float the boat'],['Sheet rests flat','Both hands shape paper','Edges form a boat','Water held in a tray'],boat,'boat'),
('F7','Block tower','focus','Each block is supported by a stable base on a floor mat.',['Place the base','Add one block','A taller tower','Flag on the tower'],['Wide base on the mat','Hand places the next block','Blocks remain aligned','Hands relax after placement'],blocks,'blocks'),
('F8','Stargazing','focus','A cushion and blanket support the companion beneath a gradually fuller sky.',['Settle in','Find a pattern','More stars','A shooting star'],['Cushion meets the ground','A small constellation','Sky grows gently','One quiet streak'],stars,'stars'),
('R1','Stretch and relax','rest','A soft floor mat supports the feet throughout the stretch.',['Settle','Reach upward','Open the arms','Relax'],['Feet planted on mat','Slow comfortable reach','A broad easy stretch','Return to resting hands'],stretch,'stretch'),
('R2','Watch the clouds','rest','The companion rests on a cushion and blanket while clouds cross the open sky.',['Look up','Watch a cloud','A new shape','Rest quietly'],['Cushion supports body','Cloud drifts slowly','Shapes change softly','Nothing to complete'],clouds,'clouds'),
('R3','Warm drink','rest','A side table and coaster provide a resting place; both hands support the warm cup.',['Hold the cup','Blow gently','Take a sip','Settle'],['Cup held in both hands','Steam stays delicate','Cup meets the mouth','Side table stays nearby'],drink,'drink')]
scenes=[]
for sid,title,kind,support,labels,captions,fn,slug in meta:
    frames=[{'label':f'{[0,40,75,100][i]}% · {labels[i]}' if kind=='focus' else labels[i], 'caption':captions[i], 'svg':fn(i)} for i in range(4)]
    scenes.append({'id':sid,'title':title,'kind':kind,'support':support,'frames':frames})
    fallback=':root {--background:#f7fbff;--foreground:#204b72;--blue:#79baf0;--orange:#edc19d;--green:#8ab99c;} @media(prefers-color-scheme:dark){:root{--background:#142638;--foreground:#dceeff;--blue:#79baf0;--orange:#edc19d;--green:#8ab99c;}}'
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="360" viewBox="0 0 1280 360" role="img" aria-labelledby="title desc"><title id="title">{html.escape(title)} — concept storyboard</title><desc id="desc">{html.escape(support)} Four static design frames; not motion performance evidence. Character silhouette derives from the project original companion-spec.json.</desc><style>{fallback}{styles}text{{fill:var(--foreground);font-family:system-ui,sans-serif;}}</style><rect width="1280" height="360" fill="var(--background)"/><text x="18" y="27" font-size="21" font-weight="500">{sid} · {html.escape(title)} · concept storyboard</text><text x="18" y="49" font-size="14">{html.escape(support)}</text>'
    for i,f in enumerate(frames):
        svg+=f'<svg class="sb-art" x="{i*320}" y="65" width="320" height="240" viewBox="0 0 320 240">{f["svg"]}</svg><text x="{i*320+18}" y="325" font-size="16" font-weight="500">{html.escape(f["label"])}</text><text x="{i*320+18}" y="347" font-size="14">{html.escape(f["caption"])}</text>'
    svg+='</svg>\n'
    (out/f'scene-storyboards/{sid}-{slug}.svg').write_text(svg)
    if sid=='F4':(out/'tea-progression-storyboard.svg').write_text(svg)
(out/'scene-storyboards.json').write_text(json.dumps({'version':1,'viewBox':'0 0 320 240','styles':styles,'scenes':scenes},ensure_ascii=False,indent=2)+'\n')
print('Generated 11 scenes, 44 frames and matching SVG sheets')
