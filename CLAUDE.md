# Directives Claude Code

## Commandes fréquentes
- Build : `npm run build` (ou `pnpm build`)
- Dev : `npm run dev`
- Tests : `npm test`
- Lint/Typecheck : `npm run typecheck` && `npm run lint`

## Directives d'exécution
- Privilégier les modifications chirurgicales de fichiers via les outils de diff plutôt que des remplacements complets.
- Nettoyer ou tronquer les sorties de logs longues avant analyse.
- Suivre les conventions TypeScript strictes du dépôt.
- Proposer un plan d'action en 2-3 puces avant d'appliquer des changements multi-fichiers.

# Directives du Projet

## Interface : Aura

L'UI repose sur **Aura**, un design system mobile-first copié dans `src/aura/`
(CSS + primitives React + PWA). Il ne s'installe pas via npm : on copie, puis on
personnalise.

- Source de vérité : `C:\Users\alex-\Workspace\Perso\Aura`.
- Tokens : `src/aura/aura.css` (`--aura-*`). Le pont Tailwind est dans
  `src/index.css` (`@theme`).
- Contraintes dures :
  1. Aucune couleur hexadécimale dans un écran : utiliser `var(--aura-*)` ou les
     classes `bg-surface`, `text-muted`, `border-line`, `text-danger`…
  2. Une seule carte héro par écran (`Card variant="hero"`).
  3. Un seul accent. Les états passent par `--aura-success/warn/danger`.
  4. Cibles tactiles ≥ 44 px, safe areas respectées.
  5. Glassmorphism réservé aux barres et overlays, jamais au contenu.
  6. `Sheet` pour les actions secondaires, pas une nouvelle route.
- Le thème est forcé en clair (`ThemeProvider defaultTheme="light"`) tant que le
  mode sombre n'est pas audité écran par écran.
- Pour ajouter un composant du kit au projet :
  `node C:\Users\alex-\Workspace\Perso\Aura\cli\aura.mjs add Sheet,Segmented --dir .`

Toute refonte visuelle doit rester cohérente avec `Aura/DESIGN.md`.

## Authentification serveur

Les comptes vivent dans **`src/aura/auth/`** (module Aura copié) et ne concernent
que l'API de sauvegarde. L'app reste local-first : aucun compte n'est requis
pour l'utiliser hors ligne.

- Activation : `AUTH_SECRET` (32+ caractères). Sans lui, l'API reste en mode
  jeton historique (`DRIVLY_TOKEN`).
- Création de compte : protégée par `DRIVLY_TOKEN` (`registrationCode`).
- Sessions : JWT Bearer (`exposeToken: true`), pas de cookie (app et API peuvent
  être sur des origines différentes, parfois en HTTP sur le LAN).
- Pas de SMTP sur ce serveur : `requireOtpOnLogin: false`,
  `requireEmailVerification: false`. La réinitialisation par email renvoie 503.
- Les sauvegardes sont partagées entre les comptes d'un même serveur.
- Ne pas ajouter `AuthScreen` pour bloquer l'app : l'écran de connexion est
  intégré à **Plus → Sauvegarde serveur**.
- Détails et contrat d'API : `src/aura/auth/README.md`.

## Knowledge Graph Navigation
- Ce projet utilise Graphify pour la cartographie des dépendances et du contexte.
- Ne charge pas et ne lis pas l'ensemble des dossiers à l'aveugle.
- Consulte d'abord le graphe / l'index de connaissances Graphify pour naviguer uniquement vers les fichiers et fonctions nécessaires à la tâche demandée.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
