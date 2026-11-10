# État du projet — English Buddy

Dernière mise à jour : 2026-11-09 (fin de la construction de la phase 0).

## Où on en est

- **Phase 0 construite, en attente du test de Franco.** Branche `phase-0`.
- Lien de test : <https://johnfrancis6.github.io/english-buddy/> (à activer
  une fois, voir le guide).
- Guide de test : [tests/phase-0.md](tests/phase-0.md).
- Rien ne passe à la phase 1 sans le feu vert de Franco.

## Ce que Franco doit faire maintenant

- [ ] Activer GitHub Pages et autoriser les branches `phase-*` (clics exacts
      au début du guide de test).
- [ ] Faire les tests du guide avec sa clé Gemini et rapporter : délai
      médian, tenue des 10 minutes, voix, lèvres, interruption.
- [ ] Donner le feu vert (ou non) pour la phase 1.

## Auto-critique de la phase 0

Ce qui marche (mesuré dans la session de construction, Chromium sans carte
graphique) :

- Le personnage se charge, regarde la caméra, cligne des yeux, respire ;
  angles de tête mesurés à ±3°.
- Les lèvres s'ouvrent sur un son et se referment dans le silence (test
  automatique).
- La clé est gardée dans `localStorage` et relue après rechargement.
- Une fausse clé donne le bon message en français (réponse réelle de
  Google : « API key not valid », code 1007).
- 21 tests de logique + 1 test de fumée Playwright au vert ; lint au vert.

Ce qui est **supposé, pas mesuré** (aucune clé dans la session : aucune vraie
conversation n'a été faite) :

- Que `gemini-3.8-live` accepte la clé gratuite de Franco et notre
  configuration (voix « Puck », transcription, reprise de session).
- Le délai réel (objectif < 1,5 s), la qualité de la voix, l'interruption.
- La tenue sur 10 minutes et la reconnexion automatique vers 10 minutes.
- Les messages « quota dépassé » et « modèle indisponible » (textes de
  Google devinés).
- La fluidité sur la GTX 1070 (aucun doute sérieux, mais non mesurée).
- Le déploiement GitHub Pages (dépend des réglages que seul Franco peut
  faire).

Ce qui est faible :

- Lèvres : basées sur le volume et trois bandes de fréquences, pas sur les
  vrais sons. Bouche ouverte/fermée au bon moment, formes approximatives.
- Le délai affiché dépend d'un seuil de volume du micro : dans une pièce
  bruyante ou avec un micro très faible, des tours peuvent ne pas être
  comptés.
- Le modèle 3D pèse 18 Mo (premier chargement lent sur une connexion
  lente) et n'est qu'un modèle d'essai.
- Pas de pipeline de secours (Groq Whisper + texte + voix) : prévu
  seulement si le test de 10 minutes échoue.

## Prochaine session

- Si le test est bon : phase 1 (conversation pédagogique), modèle conseillé
  **Opus 5.5**. Prompt : « Lis CLAUDE.md, docs/STATE.md et docs/BRIEF.md,
  puis réalise la phase 1. Arrête-toi à la fin de la phase. »
- Si le test échoue (refus du quota, coupures, délai > 1,5 s) : coller le
  rapport, corriger la phase 0 et tester le pipeline de secours avant la
  phase 1.

## Journal

| Date | Phase | Ce qui a été fait | Note de Franco |
|---|---|---|---|
| 2026-11-09 | Cadrage | Brief, décisions, état | — |
| 2026-11-09 | Phase 0 | Squelette Vite/TS, personnage VRM (regard, clignement, repos), voix Gemini Live avec clé du navigateur, lèvres synchronisées, mesure du délai, messages d'erreur, déploiement Pages, guide de test. Conversation réelle non testée (pas de clé en session) | Déploiement vert, « l'essai marche » (2026-11-10). Mesures détaillées à rapporter |
| 2026-11-10 | Phase 0 (retouche) | Réglage « Ton rythme de parole » : silence de fin de tour au choix (0,5 / 0,9 / 1,5 s) | En attente |

## Points ouverts

- Nom définitif de la plateforme (provisoire : « English Buddy »).
- Quatrième personnage (conférence / école) : hors version 1.
- Fiches personnages `docs/characters.md` (Jake, Emma, Maya) pour VRoid
  Studio : à écrire au plus tard au début de la phase 2 (le brief les
  attend « à partir de la phase 0 »).
- Noms des voix Gemini (« Puck »…) non vérifiés dans la doc officielle.
- Garde-fou d'écho : seule l'annulation d'écho du navigateur est activée ;
  à revoir si quelqu'un utilise des haut-parleurs.
- Le site Pages affiche la dernière branche poussée (`main` ou `phase-*`) :
  à revoir quand `main` servira de version stable (phase 8).
- Poids du modèle 3D (18 Mo) : à réduire quand Franco exportera ses propres
  personnages.
- Détection « intelligente » des phrases inachevées (distinguer une
  hésitation d'une fin de phrase) : l'API Gemini ne propose qu'une durée de
  silence. Une vraie détection demanderait notre propre détecteur dans le
  navigateur ; à décider après le retour de Franco sur le réglage de rythme.
