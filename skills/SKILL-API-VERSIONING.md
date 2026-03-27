# SKILL-API-VERSIONING.md — Comment versionner l'API AgentShield

> Lire AVANT de changer un endpoint existant ou d'ajouter un breaking change. Réfs : API.md, SDK.md

---

## STRATÉGIE

```
URL prefix : /v1/, /v2/ (quand nécessaire)
Actuellement : tout est /v1/
On ne crée /v2/ que quand un breaking change est inévitable.
```

## QU'EST-CE QU'UN BREAKING CHANGE

```
Breaking (nécessite un nouveau version) :
  - Supprimer un champ de réponse
  - Renommer un champ de réponse
  - Changer le type d'un champ
  - Supprimer un endpoint
  - Changer un code d'erreur
  - Modifier le comportement par défaut

PAS breaking (OK dans /v1/) :
  - Ajouter un champ optionnel dans la requête
  - Ajouter un champ dans la réponse
  - Ajouter un endpoint
  - Ajouter un code d'erreur
  - Ajouter un event type webhook
```

## AVANT v1.0.0 (LAUNCH)

```
Pendant le développement, on peut faire des breaking changes librement.
Les codes d'erreur, les payloads, les endpoints peuvent changer.
Pas de garantie de compatibilité.
```

## APRÈS v1.0.0

```
1. Annoncer le breaking change 2 semaines avant
2. Documenter dans CHANGELOG.md section "Breaking"
3. Maintenir /v1/ pendant 6 mois minimum
4. Créer /v2/ avec les changements
5. Header Deprecation: true sur les endpoints /v1/ dépréciés
6. Mettre à jour le SDK pour supporter les deux versions
```

## HEADERS

```
X-AGS-API-Version: v1           ← retourné dans chaque réponse
Deprecation: true                ← si l'endpoint est déprécié
Sunset: Sat, 01 Nov 2026 00:00:00 GMT  ← date de fin de support
Link: <https://docs.agentshield.one/migration>; rel="successor-version"
```

## RÈGLES

```
1. /v1/ est le contrat avec les utilisateurs du SDK
2. Les codes d'erreur ne changent JAMAIS (les clients SDK les matchent)
3. Ajouter un champ est OK, en supprimer un est breaking
4. En cas de doute → c'est breaking
5. Le SDK gère la version automatiquement (le dev ne choisit pas)
```
