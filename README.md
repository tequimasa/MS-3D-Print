# Antigravity 3D - Application de Chiffrage

Une application premium pour le calcul de coût et la génération de devis d'impression 3D, optimisée pour le marché français.

## Fonctionnalités
- **Calculateur de précision** : Prise en compte du filament, de l'électricité (tarif Enedis), de l'amortissement machine et de la main d'œuvre.
- **Bibliothèque de Produits** : Sauvegardez vos pièces pour ne pas avoir à recalculer les tarifs.
- **Générateur de Devis** : Créez des devis professionnels prêts à être imprimés ou exportés en PDF.
- **Design Chic & Moderne** : Interface épurée avec mode sombre (par défaut) et mode clair.
- **Confidentialité** : Toutes vos données sont stockées localement dans votre navigateur (LocalStorage).

## Utilisation (Mode Serveur Local)
1. Ouvrez un terminal dans le dossier du projet.
2. Lancez le serveur avec la commande : `npm start`
3. Ouvrez votre navigateur sur : **http://localhost:3001**

## Pourquoi ce mode ?
- **Portabilité totale** : Copiez le dossier n'importe où, vos données vous suivent dans `data/db.json`.
- **Sauvegarde Réelle** : Contrairement au mode fichier, vos produits et paramètres sont écrits dans un fichier JSON sur votre disque dur.
- **Prêt pour le Web** : Ce serveur peut être déployé sur un réseau local ou un VPS très facilement.

## Paramètres par défaut (France 2025)
- **Électricité** : 0.2516 €/kWh (Estimation Enedis/EDF Tarif Bleu).
- **TVA** : 20% (Calculée automatiquement sur le devis).
- **Amortissement** : Configuré pour une machine de ~1000€ sur 2000 heures.

---
*Développé avec soin par Antigravity.*
