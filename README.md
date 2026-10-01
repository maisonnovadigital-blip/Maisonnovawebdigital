# Nova Web Prospector

Outil interne de prospection de l'agence **Nova Web** : il trouve des entreprises locales (métier + ville), vérifie leur présence en ligne, note la qualité de leur site, qualifie leur potentiel commercial et prépare des messages personnalisés (email, Instagram, LinkedIn, appel, WhatsApp) — avec un CRM, des relances et un assistant, **Nova AI**.

> Aucune donnée n'est inventée : une information introuvable est affichée « Non trouvé ».
> Aucun message n'est envoyé automatiquement : chaque envoi est validé par un humain.

---

## Démarrage rapide

Prérequis : **Node.js 20.9 ou plus** (24 recommandé).

```bash
npm install
npm run setup     # crée .env.local avec un AUTH_SECRET aléatoire
npm run dev       # http://localhost:3000
```

Au premier lancement, l'application demande de **créer le compte administrateur**. La base de données (PostgreSQL embarqué, PGlite) est créée automatiquement dans `.data/pglite` : aucune installation de base n'est nécessaire en local.

L'application fonctionne **immédiatement sans aucune clé API** :

| Fonction | Sans clé | Avec clé |
|---|---|---|
| Recherche d'entreprises | OpenStreetMap (gratuit, sans notes/avis) | Google Places (notes, avis, téléphone, site, fiche Maps) |
| Analyse des sites | Inspection réelle du code public (HTTPS, mobile, SEO, conversion…) | + scores Lighthouse et capture d'écran (PageSpeed) + revue visuelle IA |
| Messages | Moteur de règles personnalisé (données réelles, formulations variées) | Nova AI (Claude) |
| Nova AI (assistant) | Commandes prédéfinies (voir plus bas) | Conversation libre avec accès aux outils de l'application |
| Réseaux sociaux | Liens publiés sur le site / dans la source | + recherche web (Brave ou Serper), activité Instagram (API Graph) |
| Envoi d'emails | « Ouvrir dans ma messagerie » | Envoi SMTP depuis votre boîte, après confirmation |

La page **Paramètres → Configuration** indique l'état de chaque intégration, explique comment l'activer et propose un bouton **« Tester la connexion »** (appel réel et minimal au service).

---

## Où renseigner les clés

Toutes les clés se placent dans **`.env.local`** (jamais dans l'interface, jamais envoyées au navigateur), puis l'application doit être redémarrée. Le modèle complet est dans [`.env.example`](.env.example).

| Variable | Service | Rôle | Obtenir la clé |
|---|---|---|---|
| `AUTH_SECRET` | — | **Obligatoire.** Signature des sessions (32+ caractères). | `npm run setup` |
| `DATABASE_URL` | PostgreSQL | **Obligatoire en production.** Vide = base embarquée locale. | Supabase, Neon… (URL de connexion) |
| `GOOGLE_MAPS_API_KEY` | Google Places API (New) | Recherche d'entreprises riche. | Google Cloud → activer « Places API (New) » → créer une clé restreinte à cette API |
| `GOOGLE_PAGESPEED_API_KEY` | PageSpeed Insights | Lighthouse mobile + capture d'écran. | Même projet Google Cloud → activer « PageSpeed Insights API » (la clé Places peut être réutilisée si l'API y est autorisée) |
| `ANTHROPIC_API_KEY` | Claude | Messages, Nova AI, propositions, revue visuelle. | platform.claude.com → API keys |
| `ANTHROPIC_MODEL` | Claude | Modèle (défaut `claude-opus-5-5`). | — |
| `BRAVE_SEARCH_API_KEY` ou `SERPER_API_KEY` | Recherche web | Sites non référencés, comptes sociaux. | api-dashboard.search.brave.com / serper.dev |
| `INSTAGRAM_GRAPH_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Instagram Graph API | Abonnés et activité des comptes professionnels. | developers.facebook.com (app reliée à votre compte Instagram pro) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_DAILY_LIMIT` | Votre messagerie | Envoi unitaire après validation, plafond journalier. | Paramètres SMTP de votre fournisseur |
| `OSM_CONTACT_EMAIL` | OpenStreetMap | Identification auprès de Nominatim (politique d'usage). | Votre email |

**Coûts** : Google Places et PageSpeed sont facturés à l'usage au-delà des quotas gratuits Google (consultez la grille tarifaire en vigueur). Une recherche Google lit au plus 21 pages de 20 résultats. Avec Claude, la génération des messages après une prospection se limite aux prospects au potentiel ≥ 50.

---

## Le workflow

1. **Recherche** — Prospection : métier, ville, rayon, nombre, filtres (sans site, site faible / moyen / correct, email / Instagram / téléphone disponibles), source.
2. **Collecte** — Google Places (pagination + sous-zones au-delà de 60 résultats) ou OpenStreetMap (Overpass) ; dédoublonnage (identifiant source, téléphone, domaine, nom + code postal, proximité) ; liste d'opposition appliquée.
3. **Enrichissement** — visite de la page d'accueil et des pages contact / mentions légales : emails et téléphones publiés, réseaux sociaux, outils de réservation.
4. **Analyse des sites** — Website Score /100 (voir plus bas), problèmes, points forts, opportunités, aperçu.
5. **Qualification** — potentiel commercial /100, « Pourquoi ce prospect ? », angle commercial, canal recommandé.
6. **Génération des messages** — email (objet + corps), DM Instagram, LinkedIn (≤ 300 caractères), script d'appel 20–30 s, WhatsApp (numéro mobile uniquement).
7. **Validation humaine** — relecture, modification, alertes « à vérifier » (chiffres absents des données, formulations excessives).
8. **Contact** — ouverture dans l'outil adapté (messagerie, Instagram, LinkedIn, WhatsApp, appel) puis « Marquer comme envoyé », ou envoi SMTP après confirmation. Le prospect passe en « Contacté » et les relances J+3, J+7, J+14 sont planifiées.

La recherche s'exécute **par étapes reprenables** : la page de suivi appelle `/api/searches/:id/step` en boucle ; chaque appel traite une tranche bornée dans le temps. Une recherche interrompue (fermeture de l'onglet, erreur réseau, quota) se reprend où elle s'était arrêtée, et le fonctionnement est compatible avec les hébergeurs serverless.

### Pages

- **Dashboard** — indicateurs (trouvés, qualifiés, sans site, sites faibles, messages, contactés, réponses, clients, taux de réponse et de conversion), activité sur 14 jours, qualité des sites, meilleures opportunités, relances dues, pipeline.
- **Prospection** — formulaire, progression en direct, résultats en cartes ou tableau, actions groupées.
- **Prospects** — onglets Tous / Nouveaux / À contacter / Contactés / Réponses / Clients / Perdus, recherche, filtres, tri, pagination (dans l'URL), sélection multiple, export CSV, suppression, ajout manuel.
- **Fiche prospect** — informations sourcées et corrigeables, présence digitale, pourquoi ce prospect, analyse du site et aperçu, messages par canal, relances, proposition commerciale, suivi CRM, notes, historique.
- **Messages** — tous les messages à envoyer / envoyés, relances dues.
- **CRM** — kanban des 10 statuts (glisser-déposer, souris / tactile / clavier).
- **Statistiques** — activité sur 7 / 30 / 90 jours, pipeline, qualité des sites, distribution du potentiel, métiers, villes, efficacité des canaux. Chaque graphique a une vue tableau.
- **Paramètres** — agence et signature, rédaction et relances, équipe, compte, conformité (liste d'opposition) ; **Configuration** des intégrations.

### Nova AI

Bouton « Nova AI » en haut de l'écran. Il connaît la sélection courante et le prospect ouvert.

- *Trouve-moi les 30 restaurants de Lyon sans site.*
- *Trouve-moi les coiffeurs de Villeurbanne avec un site faible.*
- *Montre-moi uniquement les prospects avec Instagram et téléphone.*
- *Analyse ces 20 prospects.* (sélection)
- *Génère les messages pour tous les restaurants sélectionnés.*
- *Donne-moi les 10 prospects présentant le plus d'opportunités.*
- *Transforme ce prospect en proposition commerciale.*

Sans clé Anthropic, ces commandes sont interprétées par règles. Avec la clé, Claude pilote les mêmes outils (recherche, prospection, analyse, messages, statuts, proposition) et peut converser librement, toujours à partir des seules données de l'application.

---

## Les scores

### Website Score (0–100)

| Catégorie | Points | Exemples de contrôles |
|---|---|---|
| Technique & sécurité | 15 | HTTPS, contenu mixte, temps de chargement, favicon, langue, doctype |
| Mobile | 15 | viewport, mise en page responsive, numéro cliquable |
| Performance | 10 | Lighthouse mobile si disponible, sinon poids, scripts, images, réactivité |
| SEO de base | 15 | title, meta description, H1, textes alternatifs, données structurées, Open Graph, noindex |
| Conversion & contact | 25 | appels à l'action, formulaire, objectif du métier (réservation, RDV, devis, commande), téléphone, email, adresse, horaires |
| Contenu & confiance | 10 | réseaux sociaux, mentions légales, confidentialité, fraîcheur (©), contenu, visuels |
| Modernité du design | 10 | indices techniques (tableaux de mise en page, Flash, balises obsolètes, CMS anciens, technologies récentes) ou revue visuelle IA |

Plafonds : site sans HTTPS ≤ 64, non adapté au mobile ≤ 39, exclu de Google ≤ 59, deux défauts critiques ou Flash/frames ≤ 29.
Catégories : 🔴 0–29 très faible · 🟠 30–49 à améliorer · 🟡 50–69 moyen · 🟢 70–84 correct · 🔵 85–100 excellent.
Cas particuliers détectés : aucun site, lien vers un réseau social ou une plateforme (TheFork, Planity, ancien site Google Business…), domaine parqué ou **à vendre**, site en construction, site inaccessible (DNS, certificat, erreur HTTP), site qui bloque les robots (aucun contournement), robots.txt interdisant l'analyse (respecté).

### Potentiel commercial (0–100)

Opportunité liée au site (45) + réputation (25 : nombre d'avis et note, 0 si inconnus) + moyens de contact (15) + présence digitale (10) + importance du site pour le secteur (5). Établissement fermé ou opposition enregistrée : 0. La « fiabilité des données » indique la part d'informations clés trouvées.

---

## Architecture

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**, **Tailwind CSS 4**, primitives Radix, Recharts, dnd-kit.
- **Drizzle ORM** : PGlite (PostgreSQL embarqué) en local, PostgreSQL via `DATABASE_URL` en production. Migrations SQL dans `drizzle/`.
- **Authentification** maison : mots de passe hachés (scrypt), session JWT signée (`AUTH_SECRET`), contrôle dans `src/proxy.ts`, limitation des tentatives, protection CSRF (vérification de l'origine).
- **Sécurité des requêtes sortantes** : les sites sont visités via un client qui refuse les adresses privées (protection SSRF, y compris après résolution DNS), limite taille et durée, s'identifie honnêtement (`NovaWebProspector`) et respecte robots.txt.

```
src/
  app/                    pages (groupe (app) protégé) et routes API (app/api)
  components/             interface (ui/, layout/, prospects/, prospect/, prospection/, crm/, charts/, settings/, assistant/)
  lib/
    analysis/             récupération sécurisée, robots.txt, extraction, notation des sites
    providers/            Google Places, OpenStreetMap, PageSpeed, recherche web, Instagram
    qualification/        potentiel, raisons, angle commercial
    messages/             contexte de faits vérifiés, moteur de règles, contrôle de fiabilité
    ai/                   client Claude (repli serveur activé), messages, revue visuelle
    assistant/            Nova AI (outils, règles, agent)
    pipeline/             collecte, dédoublonnage, filtres
    services/             recherches, prospects, enrichissement, messages, stats, export, paramètres
    db/                   schéma Drizzle et connexion
    sectors.ts            catalogue des métiers (types Google, tags OSM, playbooks commerciaux)
tests/                    tests unitaires (Vitest)
drizzle/                  migrations SQL
```

---

## Conformité et éthique

- Uniquement des **données professionnelles publiques**, via des **API officielles** (Google Places, OpenStreetMap, PageSpeed, Instagram Graph) ou publiées par l'entreprise sur son propre site.
- **robots.txt respecté** ; aucun contournement de protection (anti-robots, captcha, emails masqués : signalés, jamais décodés). Aucune collecte sur Instagram, LinkedIn ou Google Maps hors API.
- **Liste d'opposition** (Paramètres → Conformité, ou « Ne pas contacter » sur une fiche) : l'entreprise est exclue des recherches, des messages et des exports.
- **Ligne d'opposition** ajoutée aux emails, **validation humaine** de chaque envoi, **3 relances maximum** arrêtées dès qu'une réponse est enregistrée, plafond quotidien d'envoi SMTP.
- Les sources des données sont tracées sur chaque fiche (Google, OpenStreetMap, site de l'entreprise, recherche web, saisie manuelle). Données OpenStreetMap © contributeurs OpenStreetMap (ODbL).
- Conservez les prospects inactifs au maximum la durée définie (36 mois par défaut) puis supprimez-les.

---

## Déploiement (Vercel + Supabase ou Neon)

1. Créez une base PostgreSQL et copiez son URL de connexion (pooler accepté).
2. Variables d'environnement du projet Vercel : `DATABASE_URL`, `AUTH_SECRET` et les clés souhaitées.
3. Appliquez les migrations : renseignez `DATABASE_URL` dans `.env.local` puis lancez `npm run db:migrate` (ou définissez `DB_AUTO_MIGRATE=true` sur l'hébergeur).
4. Déployez. Les routes longues déclarent `maxDuration` (jusqu'à 300 s) ; la prospection par étapes s'adapte aux limites serverless.

PGlite (base embarquée) ne convient **pas** au serverless (disque éphémère) : en production, `DATABASE_URL` est obligatoire.

---

## Commandes

| Commande | Action |
|---|---|
| `npm run setup` | Crée `.env.local` (secret aléatoire) |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires |
| `npm run db:generate` | Génère une migration après modification du schéma |
| `npm run db:migrate` | Applique les migrations (PostgreSQL) |

Pour repartir d'une base locale vide : arrêtez le serveur et supprimez le dossier `.data/`.

---

## Dépannage

- **« unable to verify the first certificate »** : un antivirus (AVG, Avast, Kaspersky…) ou un proxy d'entreprise inspecte le HTTPS. Les scripts `npm run dev/build/start` activent automatiquement les certificats du système (`NODE_USE_SYSTEM_CA=1`). Si vous lancez Next.js autrement, définissez cette variable.
- **OpenStreetMap lent ou indisponible** : le service Overpass public est parfois surchargé ; l'application essaie des serveurs de secours. Réduisez le rayon ou réessayez (bouton « Reprendre »).
- **Quota Google dépassé** : la collecte s'arrête proprement et l'analyse continue avec les entreprises déjà trouvées.
- **Un site est « inaccessible »** : le détail (DNS, certificat, erreur HTTP) est affiché sur la fiche ; un lien profond mort ou une variante `www.` sont testés avant de conclure.
