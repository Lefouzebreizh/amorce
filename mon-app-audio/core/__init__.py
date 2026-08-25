"""Moteur de l'application : alignement voix-texte et mixage.

Deux modules, séparés parce qu'ils ne bougent pas ensemble : `synchroniseur`
décide *quand* les choses sont dites, `mixeur` décide *comment* elles sonnent.
L'interface Streamlit ne fait que les enchaîner.
"""
