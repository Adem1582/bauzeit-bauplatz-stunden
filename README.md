# Bauzeit Bauplatz Stunden

Baue eine Web-App zur Zeiterfassung für eine kleine Baufirma (ca. 20 Mitarbeiter). Sprache der Oberfläche: Deutsch. Nutze Lovable Cloud für Datenbank und Login.

Rollen:

- Mitarbeiter: Login mit E-Mail/Passwort

- Chef (Admin): sieht und verwaltet alles

Funktionen Mitarbeiter:

- Großer Button "Einstempeln" / "Ausstempeln", Arbeitszeit wird automatisch berechnet

- Pro Arbeitstag: Baustelle auswählen und kurz eintragen, was gemacht wurde

- Übersicht der eigenen Stunden pro Woche und Monat

Funktionen Chef:

- Mitarbeiter anlegen mit Name und Stundenlohn

- Baustellen anlegen

- Alle Zeiteinträge sehen, filtern nach Mitarbeiter, Baustelle und Monat

- Einträge freigeben oder ablehnen (Status: offen / freigegeben / abgelehnt)

- Monatsübersicht pro Mitarbeiter: Gesamtstunden × Stundenlohn = Lohn

- Export der Monatsübersicht als CSV

Design: modern, sauber, mobil optimiert (Mitarbeiter nutzen es auf dem Handy auf der Baustelle). Farben: Dunkelblau und Orange, große gut klickbare Buttons.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60bf49c0-0b76-4ae4-a118-10fd35100206).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
