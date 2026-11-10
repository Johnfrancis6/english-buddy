# Guide de test complet — English Buddy (retour de Franco)

Lien : <https://johnfrancis6.github.io/english-buddy/> (il montre la dernière
branche construite : `phase-8`).

Pendant ton absence, les phases 1 à 8 ont été construites à la suite, **sans
jamais une vraie clé ni une vraie voix** : Google et Groq étaient simulés, il
n'y avait ni carte graphique ni haut-parleur. Tout ce qui s'entend, tout ce
que juge une IA et la fluidité sur ta GTX 1070 reste donc **à mesurer par
toi**. Ce guide met les tests dans le bon ordre, en environ **2 heures**
découpées en 5 séances. Chaque séance renvoie au guide détaillé de la phase :
ouvre-le quand tu veux le détail des clics.

## Avant de commencer

- Ton casque avec micro, Firefox (ton navigateur habituel), et si possible
  Chrome pour comparer une fois.
- Ta clé Gemini gratuite. La clé Groq gratuite est conseillée (elle sert au
  labo, au contrôle de prononciation et au rythme des chansons) : l'accueil
  guidé explique comment la créer.
- Garde un fichier texte ouvert pour noter tes remarques au fil de l'eau,
  avec l'heure (utile pour les quotas).
- Dans chaque écran de conversation, « Mesures de test » (fermé, en haut à
  gauche) → **Copier le rapport** : colle ce rapport dans tes notes après
  chaque conversation.

## Séance 1 — Comme un nouvel ami (30 minutes)

But : vérifier que quelqu'un qui découvre la plateforme s'en sort seul, et
que la conversation de base tient.

1. **Fenêtre privée** de Firefox, ouvre le lien. L'accueil guidé s'ouvre
   tout seul. Suis-le comme un ami le ferait : clé Gemini, clé Groq, micro,
   niveau, premier personnage. → [phase-5.md, partie 1](phase-5.md)
   - [ ] Les clics décrits pour AI Studio et Groq sont-ils exacts ?
   - [ ] Le test du micro reconnaît-il ta voix et ton casque ?
   - [ ] Ferme la fenêtre au milieu de l'accueil, rouvre : il reprend à la
         bonne étape (nouveau en phase 8).
2. **Conversation de 10 minutes avec Jake** au café, réglage de rythme
   « Rapide ». → [phase-0.md, tests 4 à 6](phase-0.md) et
   [phase-1.md, test 2](phase-1.md)
   - [ ] Délai médian (Mesures de test), coupures, Jake te coupe-t-il ?
   - [ ] Jake reformule tes fautes sans faire de leçon ?
3. **Le bilan** en français à la fin. → [phase-1.md, test 3](phase-1.md)
   - [ ] Les fautes relevées sont-elles de vraies fautes (et pas des erreurs
         de la machine qui écrit tes phrases) ? Notes trop sévères, trop
         gentilles ?

## Séance 2 — Qui t'écoute, qui te parle (30 minutes)

1. **Labo transcription** (Réglages → « labo transcription »), 10 minutes :
   c'est lui qui dit quelle source garde le mieux tes fautes.
   → [phase-1.md, test 1](phase-1.md)
   - [ ] Renvoie le tableau du labo (bouton « Copier »).
2. **Les personnages et les lieux**, 15 minutes : une courte conversation
   (3 min) avec Emma (bureau), Maya (rue) et Lily ou Ollie.
   → [phase-2.md, parties 1 à 3](phase-2.md)
   - [ ] **Images/s** sur la GTX 1070 dans chaque lieu (Mesures de test).
   - [ ] Voix acceptées par Google ? Accent britannique d'Emma ?
   - [ ] Gestes naturels, au bon moment ?
3. **La mémoire**, 5 minutes : pendant ces conversations, parle de ton
   travail, de ta famille, d'un projet. Puis « Ce qu'ils savent de moi ».
   → [phase-3.md, parties 1 et 2](phase-3.md)
   - [ ] Rien d'inventé, rien de gênant ? Corriger et effacer marchent ?

## Séance 3 — Le lendemain : habitudes (30 minutes)

À faire **un autre jour** que la séance 2, pour que les révisions et la
mémoire aient du sens.

1. **La mémoire en action** : reparle à Jake. → [phase-3.md, partie 3](phase-3.md)
   - [ ] Il se souvient naturellement, sans réciter ?
2. **Révisions à voix haute** (5 min) et **défi du jour** (7 min).
   → [phase-4.md, parties 1 à 3](phase-4.md)
   - [ ] Le personnage te tend des perches pour tes anciennes fautes, sans
         donner la réponse ? Les expressions se cochent quand tu les dis ?
3. **Une mission** (10 min), par la carte des missions.
   → [phase-4.md, partie 4](phase-4.md)
   - [ ] Trop facile, trop dure ? Note sur 100 crédible ?
4. **Mes progrès** (3 min). → [phase-3.md, partie 4](phase-3.md)
   - [ ] Utile ? Lisible ? Qu'est-ce qui manque ?

## Séance 4 — Lire, prononcer, chanter (30 minutes)

1. **Un vrai PDF** (article ou cours), puis étudier un passage avec un
   personnage (10 min). → [phase-5.md, parties 2 et 3](phase-5.md)
   - [ ] Texte propre ? Mots difficiles bien choisis ?
2. **Prononciation**, 5 phrases (10 min). → [phase-6.md, parties 1 et 2](phase-6.md)
   - [ ] **Les notes par mot sont-elles justes ?** Dis exprès « sink » pour
         « think » : la note doit baisser. C'est le risque principal.
3. **Chanter avec Maya** (10 min). → [phase-7.md, parties 1 et 2](phase-7.md)
   - [ ] Le fredonnement de Maya est-il agréable ? Les airs justes ?
   - [ ] Les notes de rythme et de prononciation chantée sont crédibles ?

## Séance 5 — Finitions et tes données (10 minutes)

→ [phase-8.md](phase-8.md)

- [ ] Réglages → « Mes données » : tout ce que la plateforme garde est
      listé ; « Effacer » d'une ligne, puis « Tout effacer » (à faire dans la
      fenêtre privée de la séance 1, pas dans ta fenêtre habituelle).
- [ ] Fenêtre étroite (environ 420 px) : la barre du haut tient sur deux
      lignes et ne cache rien.
- [ ] Coupe le Wi-Fi pendant une conversation : le message est clair et en
      français ?

## Facultatif, quand tu veux

- **Azure Speech** (mesure fine de la prononciation, gratuite jusqu'à 5 h par
  mois, compte Microsoft) : [phase-6.md, partie 4](phase-6.md).
- **Comptes en ligne Supabase** (10 minutes) : étapes dans
  [STATE.md, « À faire au retour de Franco »](../STATE.md).
- **Vraie voix chantée payante** (Lyria, environ 0,08 $ la chanson) : dis
  seulement si tu la veux.

## Ce que tu me renvoies

Un seul message suffit, dans ce format (copie-le) :

```
Séance 1 — accueil : … / conversation : délai médian …, coupures … / bilan : …
Séance 2 — labo : (tableau collé) / images/s café … bureau … rue … / voix : … / mémoire : …
Séance 3 — mémoire en action : … / révisions et défi : … / mission : … / progrès : …
Séance 4 — PDF : … / prononciation (sink/think) : … / chant : …
Séance 5 — mes données : … / 420 px : … / Wi-Fi coupé : …
Ce qui m'a le plus plu : …
Ce qui m'a le plus gêné : …
Je veux : Azure oui/non, Supabase oui/non, Lyria oui/non
Rapports « Mesures de test » : (collés)
```

Ensuite, c'est toi qui décides : inviter les amis, et fusionner la version
dans `main` (je ne l'ai pas fait : c'est ta décision).
