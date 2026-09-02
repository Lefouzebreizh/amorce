"""L'habillage visuel : un verdict devient une carte partageable.

En SVG, et en bibliothèque standard **pure** — comme le noyau. Une carte est
du texte posé dans un cadre : ni Pillow, ni Cairo, ni moteur de rendu n'y
apportent quoi que ce soit, et chacun serait une dépendance de plus à installer
sur une machine fraîche pour un résultat identique.

La rasterisation en PNG, elle, demande un navigateur — et c'est justement
pourquoi elle vit ailleurs, dans `adaptateurs/`. On peut donc éprouver la mise
en page entière, position par position, sans lancer Chromium.
"""
