# KemonDex

A modern, interactive Pokédex for discovering and exploring Pokémon.

KemonDex lets you browse Pokémon, search by name or Pokédex number, filter by type, and explore detailed Pokémon profiles. With IndexedDB-powered storage through Dexie.js, it also caches Pokémon data locally and keeps your favorites saved between visits.

## Features

- Browse Pokémon with official artwork and type information
- Search by Pokémon name or Pokédex number
- Filter Pokémon by type
- View detailed stats, abilities, height, and weight
- Save and manage favorite Pokémon
- Navigate between Pokémon from the details modal
- Cache Pokémon data for offline access
- Display online and offline connection status
- Responsive interface with smooth loading animations
- Persistent local storage powered by Dexie.js

## Built With

- HTML5
- CSS3
- JavaScript (ES Modules)
- Dexie.js
- [PokéAPI](https://pokeapi.co/)

## Getting Started

1. Clone this repository.
2. Open the project using a local development server.
3. Open `index.html` in your browser through that server.
4. Start exploring Pokémon!

## Offline Support

KemonDex uses IndexedDB through Dexie.js to store Pokémon data locally. Previously cached Pokémon information and saved favorites remain available offline, although uncached data and externally hosted images may require an internet connection.

## Data Source

Pokémon information is provided by [PokéAPI](https://pokeapi.co/).

## License

This project is intended for learning and personal development.
