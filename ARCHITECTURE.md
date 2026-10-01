# Nova Web Prospector — Architecture & plan de construction

> Statut : **application construite et testée** (voir § 10). Guide d'utilisation et d'installation : [README.md](README.md).

## 1. Stack retenue

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack) + React 19.3 + TypeScript | SaaS full-stack, API routes, déploiement Vercel |
| UI | Tailwind CSS 4.3, primitives `radix-ui`, icônes `lucide-react`, toasts `sonner`, graphiques `recharts`, kanban `@dnd-kit/core` | Accessible, premium, sans surcharge |
| Base de données | Drizzle ORM + **PGlite** (PostgreSQL embarqué, dev local sans config) / **PostgreSQL** via `DATABASE_URL` (Supabase, Neon) en production | Même schéma Postgres partout ; l'app tourne immédiatement en local |
| Auth | Comptes en base (mot de passe haché scrypt), session JWT signée (`jose`, `AUTH_SECRET`), garde dans `src/proxy.ts` (Next 16) | Outil interne sécurisé ; écran « créer le compte admin » au premier lancement |
| Validation | `zod` 4 | Entrées API |
| Analyse web | `undici` (fetch + protection SSRF via lookup DNS), `cheerio`, `robots-parser`, `libphonenumber-js` | Analyse réelle, respect de robots.txt, aucun contournement |
| IA | `@anthropic-ai/sdk`, modèle par défaut `claude-opus-5-5` (configurable `ANTHROPIC_MODEL`), sorties structurées (`messages.parse` + `zodOutputFormat`), `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) activé par défaut | Messages personnalisés, Nova AI (tool use), revue visuelle |
| Email | `nodemailer` (SMTP de l'agence), envoi unitaire après validation humaine, plafond journalier | Contact « via une intégration autorisée » |
| Tests | `vitest` (scoring, analyse, messages, CSV, parseur Nova AI) + parcours testés dans le navigateur | |

## 2. Sources de données (aucune simulation)

1. **Google Places API (New)** — `places:searchText` (pagination ≤ 60 résultats/zone, quadrillage de sous-zones au-delà), field mask : id, nom, adresse, composants, position, types, téléphone, site, `googleMapsUri`, note, nombre d'avis, horaires, statut, résumé. Clé `GOOGLE_MAPS_API_KEY`.
2. **OpenStreetMap** (gratuit, sans clé, licence ODbL — attribution « © contributeurs OpenStreetMap ») — Nominatim (géocodage, mis en cache) + Overpass (dictionnaire métier → tags OSM : `amenity=restaurant`, `shop=hairdresser`, `office=estate_agent`, `craft=plumber`…). Utilisé quand Google n'est pas configuré. Pas de notes/avis ; l'absence de site y est affichée comme « aucun site référencé (à vérifier) ».
3. **Site de l'entreprise** — page d'accueil + jusqu'à 3 pages internes (contact, mentions légales) : emails publics, liens Instagram/Facebook/LinkedIn, téléphone.
4. **PageSpeed Insights** (optionnel) — scores Lighthouse mobile + capture d'écran réelle (aperçu du site).
5. **Recherche web** Brave ou Serper (optionnel) — retrouver un site non référencé / des réseaux sociaux ; résultats marqués « trouvé via recherche web — à vérifier ».
6. **Instagram Graph API — Business Discovery** (optionnel) — abonnés et date du dernier post → « Instagram actif ». Sans elle : « Instagram détecté (activité non vérifiée) ».

Toute donnée absente est affichée « Non trouvé ». Chaque donnée garde sa source.

## 3. Pipeline de prospection (tâche pilotée par étapes)

`POST /api/searches` crée la recherche, puis le client appelle `POST /api/searches/:id/step` en boucle (verrou optimiste `lockedUntil`, reprise possible, compatible avec les timeouts serverless) :

`geocode` → `collect` (pagination/quadrillage, dédoublonnage : id source, téléphone normalisé, domaine, nom+CP ; liste d'opposition) → `enrich` (crawl + extraction + analyse heuristique, 4 sites en parallèle) → `pagespeed` (si clé) → `qualify` (scores, « Pourquoi ce prospect ? », filtres) → `messages` (si option cochée) → `done`.

Libellés de progression : Recherche des entreprises… / Analyse des établissements… / Vérification des sites… / Analyse de la présence digitale… / Qualification des prospects… / Génération des opportunités…

Erreurs gérées : clé invalide (403), quota dépassé (429 → arrêt propre avec résultats partiels), réseau, site inaccessible, site bloquant (403/429/challenge → « analyse bloquée », jamais contournée), robots.txt interdisant, page Facebook/plateforme tierce utilisée comme site, domaine parqué ou « en construction », établissement fermé.

## 4. Scores

**Website Score (0–100)** : technique et sécurité (15 : HTTPS, contenu mixte, temps de réponse, favicon, lang), mobile (15 : viewport, signes de mise en page responsive ou figée), performance (10 : heuristique ou Lighthouse), SEO de base (15 : title, meta description, H1, alt, JSON-LD, Open Graph, noindex), conversion (25 : CTA, formulaire, réservation/prise de RDV selon le secteur, `tel:`, contact, adresse, horaires), contenu et confiance (10 : réseaux sociaux, mentions légales, confidentialité, © récent, volume de texte), modernité (10 : signaux obsolètes Flash/frames/`<font>`/tables/vieux jQuery/CMS ancien ; signaux modernes ; revue visuelle IA optionnelle, marquée « subjective »).
Catégories : 🔴 0–29 très faible · 🟠 30–49 à améliorer · 🟡 50–69 moyen · 🟢 70–84 correct · 🔵 85–100 excellent. Chaque échec génère un problème (gravité) et une recommandation.

**Potentiel commercial (0–100)** : opportunité liée au site (45 : aucun site = 45, page tierce = 42, inaccessible = 40, sinon 45 × (100 − score)/100), réputation (25 : avis sur échelle logarithmique jusqu'à 15, note jusqu'à 10 — 0 si aucune donnée, signalé), joignabilité (15), présence digitale (10), adéquation du secteur (5) ; fermé définitivement = 0. Niveau : Élevée ≥ 75, Moyenne 50–74, Faible < 50. Indice de complétude des données affiché à côté.

## 5. Messages & personnalisation

- Fiche de faits vérifiés → angle commercial par secteur (restaurant : menu/réservation/photos/mobile ; coiffeur : RDV/prestations/galerie ; immobilier : biens/estimation/leads ; dentiste : RDV/infos patients, ton non promotionnel ; garage : devis/RDV ; hôtel : réservation directe ; artisans : devis/zone/réalisations…).
- Canaux : Email (objet + corps + ligne d'opposition), Instagram DM, LinkedIn (≤ 300 caractères), script d'appel 20–30 s, WhatsApp (uniquement si numéro mobile).
- Générateur IA (Claude, sorties structurées, interdiction d'inventer) **ou** moteur de règles déterministe (variantes par prospect) si aucune clé — toujours étiqueté selon sa source.
- Statut « Message généré — non envoyé » tant que l'utilisateur n'a pas marqué l'envoi ou envoyé via SMTP après confirmation.
- Relances J+3 / J+7 (conseil utile tiré des problèmes détectés, aucune statistique inventée) / J+14 (dernière, polie) ; arrêt automatique dès réponse, refus ou opposition.

## 6. Modèle de données (Drizzle, Postgres)

`users`, `settings` (profil agence, signature, ton, ligne d'opposition), `searches` (critères, étape, état, compteurs, avertissements, verrou), `prospects` (identité, coordonnées + sources, réseaux, Google, statut du site, score, analyse JSON, potentiel, raisons, angle, statut CRM, `inCrm`, notes, dernière interaction, prochaine relance, `doNotContact`), `search_results` (recherche ↔ prospect, `matched`, rang), `website_snapshots` (capture d'écran), `messages` (canal, type initial/relance/proposition, objet, corps, générateur, statut, `sentAt`, `sentVia`, `scheduledFor`), `activities` (historique), `suppression_list` (domaine/email/téléphone/fiche), `cache` (géocodage, Overpass, PageSpeed), `notifications`.

Statuts CRM : Nouveau, Message préparé, Contacté, Réponse reçue, Appel prévu, Discussion, Proposition envoyée, Client, Pas intéressé, À relancer.
Onglets de la page Prospects : Tous · Nouveaux · À contacter (préparé, à relancer) · Contactés · Réponses (réponse, appel, discussion, proposition) · Clients · Perdus.

## 7. Pages

`/login`, `/setup` · `/dashboard` (indicateurs, graphiques, top opportunités, relances du jour) · `/prospection` (formulaire « Trouver mes prochains clients ») · `/prospection/[id]` (progression + résultats en cartes ou tableau) · `/prospects` (tableau triable, recherche, filtres, pagination via l'URL, sélection multiple, suppression, export CSV) · `/prospects/[id]` (fiche CRM : infos, présence digitale, analyse, aperçu du site, messages par canal, relances, notes, historique) · `/messages` · `/crm` (kanban + relances dues) · `/statistiques` · `/parametres` (agence, messages, équipe, conformité/opposition) · `/parametres/configuration` (état de chaque intégration + bouton « Tester »). Panneau **Nova AI** accessible partout (outils : rechercher/filtrer, lancer une prospection, top N, analyser, générer les messages, changer un statut, proposition commerciale ; mode règles sans clé).

## 8. Export CSV

Séparateur `;` + BOM UTF-8 (Excel FR). Colonnes : Entreprise, Métier, Ville, Adresse, Téléphone, Email, Site, Instagram, LinkedIn, Google Maps, Note Google, Nombre d'avis, Website Score, Potentiel, Problèmes détectés, Angle commercial, Message Email, Message Instagram, Message LinkedIn, Statut. Les prospects en opposition sont exclus.

## 9. Conformité

Données professionnelles publiques uniquement, APIs autorisées, User-Agent honnête, respect de robots.txt, aucun contournement de protection, aucun scraping d'Instagram, de LinkedIn ou de Google Maps. Liste d'opposition appliquée aux recherches, aux messages et aux exports. Ligne d'opposition dans les emails. Purge des prospects inactifs (recommandation CNIL : 3 ans). Jamais d'envoi automatique : validation humaine obligatoire.

## 10. Avancement

- [x] Analyse du besoin, choix de la stack, architecture, versions vérifiées (Node 24.19, npm 11.17)
- [x] `package.json`, `.env.example`, ce document
- [x] `npm install` + vérification de PGlite sur ce chemin Windows (avec espaces)
- [x] Configuration : `tsconfig`, `next.config.ts`, PostCSS, `globals.css` (thème clair/sombre), `drizzle.config.ts`, `.gitignore`
- [x] Schéma + migrations + client de base de données (migration automatique en local)
- [x] Authentification (configuration initiale, connexion, `proxy.ts`, équipe, compte)
- [x] Fournisseurs : Google Places, OSM, géocodage, PageSpeed, recherche web, Instagram Graph, Claude, SMTP
- [x] Analyse : récupération sécurisée, extraction, détection des plateformes, domaines à vendre, scoring avec plafonds, revue visuelle IA
- [x] Scoring du potentiel + « Pourquoi ce prospect ? » + moteur d'angles commerciaux par secteur
- [x] Messages (IA + règles), relances, proposition commerciale, contrôle de fiabilité
- [x] Pipeline par étapes + API REST
- [x] Interface : coque (sidebar, barre du haut, notifications, profil) et toutes les pages
- [x] Nova AI (tool use + mode règles)
- [x] Tests unitaires (31), `tsc`, build de production, parcours testés en local avec de vraies données OpenStreetMap
- [x] README (installation, clés, déploiement Vercel + Supabase)

### Écarts par rapport au plan initial

- Lanceur `scripts/next.mjs` : active les certificats du système (`NODE_USE_SYSTEM_CA=1`), indispensable derrière un antivirus qui inspecte le HTTPS.
- Seuil « prospect qualifié » unifié à 50/100 (génération automatique des messages et indicateurs).
- Analyse : repli sur la page d'accueil si le lien référencé est mort, variante `www.` testée si le domaine ne répond pas, détection des domaines mis en vente.
- Les brouillons existants reçoivent un avertissement si une nouvelle analyse change la situation du site.
