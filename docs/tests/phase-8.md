# Guide de test — phase 8 (finition)

Lien : <https://johnfrancis6.github.io/english-buddy/>

Durée : environ 10 minutes. C'est la séance 5 du
[guide complet](GUIDE-COMPLET.md). Fais-la **dans une fenêtre privée** : on y
efface tout.

## Ce qui est nouveau

- Réglages → **« Mes données »** : tout ce que la plateforme garde dans ton
  navigateur, au même endroit, avec un bouton « Effacer » par ligne et
  « Tout effacer de ce navigateur ». « Conversations, bilans et chansons »
  efface aussi les chansons et les notes de chant.
- À moins de 560 px de large, la barre du haut tient sur deux lignes, avec
  des noms courts (« Progrès », « Mémoire »).
- Messages d'erreur : chacun dit quoi faire ; « surchargé, réessaie dans une
  minute » quand Google ou Groq sont en panne.
- La page d'accueil se charge plus vite (la bibliothèque de Google n'arrive
  qu'au premier « Démarrer »).
- L'accueil guidé reprend à l'étape où tu t'étais arrêté.

## 1. Mes données (4 minutes)

1. Dans la fenêtre privée de la séance 1 (où tu as déjà parlé, chanté et lu
   des phrases), ouvre **Réglages**, descends jusqu'à **Mes données**.
2. Regarde les lignes : conversations, mémoire, révisions, documents,
   prononciation, clés.
   - [ ] Les nombres te semblent-ils justes ?
   - [ ] Manque-t-il quelque chose que tu t'attendais à voir ?
3. Clique sur **Effacer** à la ligne « Conversations, bilans et chansons »
   et confirme.
   - [ ] La ligne passe à « vide » ; « Mon dernier bilan » disparaît de
         l'accueil ; la ligne « Chanson » de l'accueil ne montre plus de
         meilleure note.
4. Clique sur **Tout effacer de ce navigateur** et confirme.
   - [ ] La page se recharge et l'accueil guidé s'ouvre comme pour un
         nouveau venu (plus de clé, plus rien).

## 2. Écran étroit (2 minutes)

1. Rends la fenêtre étroite (environ 420 px), ou ouvre le lien sur ton
   téléphone (le téléphone n'est pas prévu pour parler, seulement pour
   regarder).
   - [ ] La barre du haut tient sur deux lignes ; les cinq boutons sont
         visibles ; rien n'est caché sous la barre.

## 3. Les pannes (4 minutes)

1. Lance une conversation, puis **coupe le Wi-Fi**.
   - [ ] Un message en français dit ce qui s'est passé et quoi faire ;
         « Reconnecter » marche une fois le Wi-Fi revenu.
2. Dans les réglages, change une lettre de ta clé Gemini, enregistre, et
   lance une conversation.
   - [ ] « Google refuse cette clé… » ; remets la bonne clé ensuite.

## Ce qui a été mesuré pendant la construction (sans vraie clé)

- Effacer « Conversations, bilans et chansons » vide aussi les chansons et
  les notes de chant ; « Tout effacer » vide les 7 magasins et les clés
  (test Playwright qui lit le stockage). Un test de logique échoue si un
  futur magasin n'est pas effaçable.
- La barre du haut mesure 79 px à 360, 420 et 560 px de large (2 lignes),
  sans défilement de la page.
- Premier chargement : 285 Ko compressés au lieu de 365 Ko.

## Ta réponse

« Mes données : … / 420 px : … / Wi-Fi coupé : … / clé fausse : … »
