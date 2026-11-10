# Guide de test — phase 6 (prononciation)

Lien : <https://johnfrancis6.github.io/english-buddy/> (Chrome ou Firefox,
avec ton casque). Compte environ 25 minutes.

À tester **après** les guides des phases 1 à 5, avec ta clé Gemini (et ta clé
Groq si tu en as une).

## Ce qui est nouveau

- Sur l'accueil, une troisième ligne **« Prononciation »** avec le bouton
  **« M'entraîner »** : 5 phrases à lire à voix haute.
- Les phrases viennent, dans l'ordre : des **mots que tu as mal prononcés**
  (révisions), de **tes propres fautes et de tes mots** (la bonne phrase de
  tes bilans), puis de phrases écrites pour toi qui travaillent les sons
  difficiles pour un francophone : **th**, **h** soufflé, **r** anglais,
  **voyelles courtes et longues** (ship / sheep), la fin en **-ed**, et
  l'**accent du mot** (PHOtograph). Les mots qui contiennent un son difficile
  sont soulignés en pointillés.
- Après chaque phrase : une **note sur 100** (toujours marquée
  « estimation »), une **note par mot** (✓ bien, ~ presque, ✗ à travailler,
  avec le chiffre), les **sons à travailler** avec un conseil en français, et
  ce que la machine a entendu.
- Les mots notés sous 60 deviennent des **cartes de révision** (« Prononciation »)
  : elles reviennent au bon moment, d'abord dans l'exercice (où la note
  décide toute seule), aussi dans « Réviser à voix haute ».
- **Mes progrès** : une barre **« Prononciation »** (moyenne de tes 20
  dernières phrases, hors niveau B1/B2/C1) et **« Sons à travailler »**, un
  son par ligne, le plus faible en haut.
- **Qui note ?** Par défaut **Gemini** écoute la phrase et note chaque mot.
  Si tu as une clé Groq, **Groq Whisper** vérifie en plus : un mot qu'il ne
  reconnaît pas ne peut pas dépasser 55. En option, une clé **Azure Speech**
  (compte Microsoft, voir plus bas) donne une mesure plus fine, son par son.
- **Ta voix n'est jamais gardée** : elle reste en mémoire le temps d'être
  notée, puis elle est oubliée. Seules la phrase et les notes restent dans ton
  navigateur.

## 1. Cinq phrases (10 minutes)

1. Ouvre le lien, clique sur **« M'entraîner »** (ligne « Prononciation »).
2. En haut : « Phrase 1 sur 5 · notée par Gemini » (ou « Gemini + contrôle
   Groq »). Lis l'encadré 🔒.
3. Clique sur **« Écouter le modèle »** : la voix de ton navigateur lit la
   phrase (sa qualité dépend de ton ordinateur ; dans Firefox sous Windows,
   elle existe en général).
4. Clique sur **« Enregistrer »**, lis la phrase **normalement**, puis tais-toi
   une seconde : l'enregistrement s'arrête seul (ou clique sur « J'ai fini »).
   Attends la note (2 à 10 secondes).
5. Regarde : la note, chaque mot, « Sons à travailler », « La machine a
   entendu ».
6. **Réessaie la même phrase en exagérant une faute française** : « sink »
   pour « think », « ouse » pour « house », « work-ed » en deux syllabes. La
   note du mot doit **baisser** et le bon son doit apparaître dans « Sons à
   travailler ».
7. Fais les 5 phrases, puis lis le résumé.

À noter : les notes te semblent-elles **justes** ? Trop gentilles ? Trop
sévères ? Un son signalé que tu as pourtant bien dit ?

## 2. Révisions et progrès (5 minutes)

1. Ferme, puis ouvre **« Mes progrès »** : la barre « Prononciation » et la
   liste « Sons à travailler » (le plus faible en haut). Survole une ligne :
   les mots repérés.
2. Les cartes de prononciation apparaissent **le lendemain** dans
   « Réviser à voix haute » (« Prononce ce mot à voix haute, puis la
   phrase ») et en tête de l'exercice « M'entraîner », le mot en gras.
   Refais l'exercice demain : la note du mot met la carte à jour toute seule.

## 3. Sans bruit, avec bruit (3 minutes)

1. Lance une phrase et ne dis rien : au bout de 8 secondes, message « Je n'ai
   pas entendu ta voix ».
2. Lis une **autre** phrase que celle affichée : la note doit être très basse
   ou marquée « pas assez net, cette note ne compte pas ».

## 4. Facultatif — la mesure fine avec Azure (10 minutes, compte Microsoft)

Azure note chaque **son** (phonème) avec un modèle fait pour ça. Gratuit
jusqu'à 5 heures de son par mois (environ 3 600 phrases). Il faut un compte
Microsoft Azure : l'inscription demande en général une carte bancaire pour
vérifier l'identité (rien n'est prélevé sur l'offre gratuite F0 ; à
confirmer quand tu le fais).

Ces clics viennent de la documentation de Microsoft, **pas d'un vrai compte** :
les noms des boutons peuvent varier un peu.

1. <https://portal.azure.com> → crée un compte gratuit si besoin.
2. « Create a resource » → cherche **« Speech »** → « Create ».
3. Région : **France Central** ou **West Europe** ; niveau de prix
   **Free F0** ; un nom au choix → « Review + create » → « Create ».
4. Ouvre la ressource → « Keys and Endpoint » : copie **KEY 1** et note la
   **Location/Region** (par exemple `francecentral`).
5. Dans English Buddy : Réglages → « Prononciation » → « Clé Azure Speech
   (facultative) » : colle la clé, choisis la même région, « Enregistrer ».
6. Refais 5 phrases : en haut, « notée par Azure Speech ». Compare avec
   Gemini : laquelle te semble la plus juste ?

## Ce qui a été mesuré pendant la construction (sans vraie clé, sans vraie voix)

- Comparaison écrite des options (docs officielles du 10 novembre 2026),
  détails dans `docs/PRONUNCIATION.md`. Mesuré : Groq ne donne pas de
  confiance par mot ; Azure accepte les appels depuis le site (CORS) et
  refuse une fausse clé (401) ; les modèles phonétiques dans le navigateur
  pèsent 200 Mo à 1,3 Go.
- Avec Google et Groq **simulés** et le micro factice du navigateur de test :
  la prise de son (WAV de plus d'une demi-seconde) part à Gemini avec la
  phrase, et à Groq en `verbose_json` avec horodatage par mot ; les notes par
  mot, les sons à travailler, les cartes créées, la barre de « Mes
  progrès », la carte qui revient en tête de l'exercice ; **aucun son
  enregistré** (le stockage ne contient que du texte) ; écran à 420 px sans
  défilement horizontal.

## Ce qui reste supposé

- **La justesse des notes** de Gemini sur une vraie voix : rien ne dit dans
  la doc de Google que Gemini sait juger une prononciation. C'est le point le
  plus important de ton test.
- Que Whisper ne reconnaisse pas les mots vraiment mal dits (il est fait pour
  comprendre les accents : il en laissera passer).
- Le format exact de la réponse d'Azure avec une vraie clé (lu dans la doc,
  jamais reçu).
- Le seuil de voix pour arrêter l'enregistrement avec un vrai micro (réglé
  sur le micro factice et le test du micro de la phase 5).
- Les règles qui repèrent les sons difficiles d'après l'orthographe (pas un
  dictionnaire phonétique : quelques erreurs possibles).

## Ta réponse

Pour chaque partie : ✅ ou ❌, et une phrase. Surtout : **les notes sont-elles
justes ?** (cite 2 ou 3 mots où la machine s'est trompée). Copie le rapport
(« Mesures de test » → « Copier le rapport ») après l'exercice : il contient
une ligne par phrase notée.
