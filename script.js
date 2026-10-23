import Dexie from "https://cdn.jsdelivr.net/npm/dexie@4.2.1/+esm";

// ========================================
// 1. DATABASE SETUP
// ========================================

const db = new Dexie("PokedexDB");

db.version(1).stores({
  favorites: "id",
});

db.version(2).stores({
  favorites: "id",
  pokemon: "id, name",
});

db.version(3).stores({
  favorites: "id",
  pokemon: "id, name",
  pokemonList: "id",
});

// ========================================
// 2. DOM ELEMENTS
// ========================================

const favoritesFilter = document.querySelector("#favorites-filter");
const pokemonGrid = document.querySelector("#pokemon-grid");
const pokemonCount = document.querySelector("#pokemon-count");
const searchInput = document.querySelector("#search-input");
const typeButtons = document.querySelector("#type-buttons");

const previousButton = document.querySelector("#previous-page");
const nextButton = document.querySelector("#next-page");
const pageInfo = document.querySelector("#page-info");

const pokemonDialog = document.querySelector("#pokemon-dialog");
const pokemonDetails = document.querySelector("#pokemon-details");
const closeDialog = document.querySelector("#close-dialog");
const connectionStatus = document.querySelector(
  "#connection-status"
);

// ========================================
// 3. APP VARIABLES
// ========================================

const API_URL = "https://pokeapi.co/api/v2/pokemon";
const POKEMON_PER_PAGE = 20;

let allPokemon = [];
let filteredPokemon = [];

let favorites = [];
let showingFavorites = false;

let selectedType = "all";
let currentPage = 1;

let currentPokemonId = null;

function showLoader(message = "Loading Pokémon...") {
  pokemonGrid.innerHTML = `
    <div class="loader-container">
      <div class="loader"></div>
      <p class="loader-text">${message}</p>
    </div>
  `;
}

function showSkeletonCards(count = 20) {
  pokemonGrid.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const card = document.createElement("article");

    card.className = "skeleton-card";
    card.setAttribute("aria-hidden", "true");

    card.innerHTML = `
      <div class="skeleton skeleton-image"></div>

      <div class="skeleton skeleton-number"></div>

      <div class="skeleton skeleton-name"></div>

      <div class="skeleton skeleton-type"></div>
    `;

    pokemonGrid.appendChild(card);
  }
}

// ========================================
// CONNECTION STATUS
// ========================================

function updateConnectionStatus() {
  const isOnline = navigator.onLine;

  connectionStatus.classList.toggle("is-offline", !isOnline);

  const statusText = connectionStatus.querySelector(".status-text");

  statusText.textContent = isOnline
    ? "Online"
    : "Offline";
}

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);

updateConnectionStatus();

// ========================================
// 4. GET POKEMON DETAILS WITH CACHING
// ========================================

async function getPokemonDetails(url) {
  const pokemonId = Number(url.split("/").filter(Boolean).pop());

  // Check IndexedDB first.
  const cachedPokemon = await db.pokemon.get(pokemonId);

  if (cachedPokemon) {
    return cachedPokemon;
  }

  // Fetch from PokéAPI if not cached.
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch Pokémon details.");
  }

  const pokemon = await response.json();

  // Save the Pokémon details.
  await db.pokemon.put(pokemon);

  return pokemon;
}

// ========================================
// 5. GET AND CACHE THE POKEMON LIST
// ========================================

async function getPokemon() {
  showLoader();

  let data;
  let usingCache = false;

  try {
    // Try to fetch the latest list from PokéAPI.
    const response = await fetch(`${API_URL}?limit=100000`);

    if (!response.ok) {
      throw new Error("Failed to fetch Pokémon list.");
    }

    data = await response.json();

    // Save the list in IndexedDB.
    await db.pokemonList.put({
      id: 1,
      count: data.count,
      results: data.results,
    });
  } catch (error) {
    console.warn("Unable to fetch Pokémon list. Checking cache.");

    // Use the saved list if the network request fails.
    const cachedList = await db.pokemonList.get(1);

    if (!cachedList) {
      throw new Error(
        "Unable to load Pokémon. Connect to the internet and try again."
      );
    }

    data = cachedList;
    usingCache = true;
  }

  // Store the list in app memory.
  allPokemon = data.results;
  filteredPokemon = allPokemon;

  // Display the Pokémon count.
  pokemonCount.textContent = usingCache
    ? `${data.count} Pokémon available (offline)`
    : `${data.count} Pokémon available`;

  // Start from the first page.
  currentPage = 1;

  await loadPage();
}

// ========================================
// 6. LOAD THE CURRENT PAGE
// ========================================

async function loadPage() {
  const startIndex = (currentPage - 1) * POKEMON_PER_PAGE;

  const pagePokemon = filteredPokemon.slice(
    startIndex,
    startIndex + POKEMON_PER_PAGE
  );

  if (pagePokemon.length === 0) {
    pokemonGrid.innerHTML = "<p>No Pokémon found.</p>";
    renderPagination();
    return;
  }

  showSkeletonCards(pagePokemon.length);

  try {
    // Get details from cache or API.
    const pokemonDetailsList = await Promise.all(
      pagePokemon.map((pokemon) => getPokemonDetails(pokemon.url))
    );

    displayPokemon(pokemonDetailsList);
  } catch (error) {
    console.error("Error loading Pokémon:", error);

    pokemonGrid.innerHTML = `
      <p>Unable to load Pokémon details.
      Connect to the internet if these Pokémon are not cached.</p>
    `;
  }

  renderPagination();
}

// ========================================
// 7. DISPLAY POKEMON CARDS
// ========================================

function displayPokemon(pokemonList) {
  pokemonGrid.innerHTML = "";

  pokemonList.forEach((pokemon) => {
    const image =
      pokemon.sprites.other["official-artwork"].front_default ||
      pokemon.sprites.front_default;

    const types = pokemon.types
      .map((item) => {
        const type = item.type.name;
    
        return `<span class="type-${type}">${type}</span>`;
      })
      .join(" ");

    const card = document.createElement("article");

    card.classList.add("pokemon-card");
    card.dataset.pokemonId = pokemon.id;
    card.style.cursor = "pointer";

    const isFavorite = favorites.includes(pokemon.id);

    card.innerHTML = `
      <button
        class="favorite-button ${isFavorite ? "is-favorite" : ""}"
        aria-label="${isFavorite ? "Remove from favorites" : "Add to favorites"}"
        aria-pressed="${isFavorite}"
        type="button"
      >
        ${isFavorite ? "♥" : "♡"}
      </button>

      <div class="pokemon-image">
        ${
          image
            ? `<img src="${image}" alt="${pokemon.name}" loading="lazy">`
            : "<p>No image available</p>"
        }
      </div>

      <div class="pokemon-info">
        <p class="pokemon-number">
          #${String(pokemon.id).padStart(3, "0")}
        </p>

        <h3>${pokemon.name}</h3>

        <div class="pokemon-type">${types}</div>
      </div>
    `;

    pokemonGrid.appendChild(card);
  });
}

// ========================================
// 8. SEARCH, TYPE, AND FAVORITES FILTERS
// ========================================

async function filterPokemon() {
  const searchValue = searchInput.value.toLowerCase().trim();
  showSkeletonCards();
  // Apply search and Favorites filters.
  const matchingPokemon = allPokemon.filter((pokemon) => {
    const pokemonId = Number(
      pokemon.url.match(/\/pokemon\/(\d+)\//)?.[1]
    );

    const matchesSearch =
      pokemon.name.includes(searchValue) ||
      String(pokemonId).includes(searchValue);

    const matchesFavorite =
      !showingFavorites || favorites.includes(pokemonId);

    return matchesSearch && matchesFavorite;
  });

  try {
    if (selectedType !== "all") {
      // Load details to check each Pokémon's type.
      const pokemonDetailsList = await Promise.all(
        matchingPokemon.map(async (pokemon) => {
          const details = await getPokemonDetails(pokemon.url);

          return {
            original: pokemon,
            details,
          };
        })
      );

      // Keep only Pokémon matching the selected type.
      filteredPokemon = pokemonDetailsList
        .filter(({ details }) =>
          details.types.some(
            (item) => item.type.name === selectedType
          )
        )
        .map(({ original }) => original);
    } else {
      filteredPokemon = matchingPokemon;
    }

    // Reset pagination after filtering.
    currentPage = 1;

    updatePokemonCount();

    await loadPage();
  } catch (error) {
    console.error("Error filtering Pokémon:", error);

    pokemonGrid.innerHTML = `
      <p>Unable to filter Pokémon. Some Pokémon details
      may need an internet connection.</p>
    `;
  }
}

// ========================================
// 9. UPDATE POKEMON COUNT
// ========================================

function updatePokemonCount() {
  pokemonCount.textContent = `${filteredPokemon.length} Pokémon`;
}

// ========================================
// 10. PAGINATION
// ========================================

function renderPagination() {
  const totalPages = Math.max(
    1,
    Math.ceil(filteredPokemon.length / POKEMON_PER_PAGE)
  );

  previousButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= totalPages;

  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
}

previousButton.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadPage();
  }
});

nextButton.addEventListener("click", () => {
  const totalPages = Math.ceil(
    filteredPokemon.length / POKEMON_PER_PAGE
  );

  if (currentPage < totalPages) {
    currentPage++;
    loadPage();
  }
});

// ========================================
// 11. SEARCH EVENT WITH DEBOUNCE
// ========================================

let searchTimeout;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    filterPokemon();
  }, 300);
});

// ========================================
// 12. TYPE FILTER EVENT
// ========================================

typeButtons.addEventListener("click", (event) => {
  const button = event.target.closest(".type-button");

  if (!button) return;

  selectedType = button.dataset.type;

  document.querySelectorAll(".type-button").forEach((item) => {
    item.classList.remove("active");
  });

  button.classList.add("active");

  currentPage = 1;

  filterPokemon();
});

// ========================================
// 13. POKEMON DETAILS MODAL
// ========================================
async function navigatePokemon(direction) {
  const currentIndex = allPokemon.findIndex((pokemon) => {
    const id = Number(
      pokemon.url.match(/\/pokemon\/(\d+)\//)?.[1]
    );

    return id === currentPokemonId;
  });

  const nextIndex = currentIndex + direction;

  if (nextIndex < 0 || nextIndex >= allPokemon.length) {
    return;
  }

  const nextPokemon = allPokemon[nextIndex];

  const nextPokemonId = Number(
    nextPokemon.url.match(/\/pokemon\/(\d+)\//)?.[1]
  );

  await openPokemonDetails(nextPokemonId);
}

pokemonDetails.addEventListener("click", async (event) => {
  const favoriteButton = event.target.closest(
    ".details-favorite-button"
  );

  if (favoriteButton) {
    await toggleFavorite(currentPokemonId);

    if (!pokemonDialog.open) {
      return;
    }

    const updatedPokemon = await getPokemonDetails(
      `${API_URL}/${currentPokemonId}`
    );

    renderPokemonDetails(updatedPokemon);
    return;
  }

  const navigationButton = event.target.closest(
    ".pokemon-nav-button"
  );

  if (!navigationButton || navigationButton.disabled) {
    return;
  }

  const direction = Number(navigationButton.dataset.direction);

  await navigatePokemon(direction);
});

async function openPokemonDetails(id) {
  currentPokemonId = Number(id);

  pokemonDialog.showModal();

  pokemonDetails.innerHTML = `
    <div class="loader-container">
      <div class="loader"></div>
      <p class="loader-text">Loading Pokémon details...</p>
    </div>
  `;

  try {
    const pokemon = await getPokemonDetails(`${API_URL}/${id}`);

    renderPokemonDetails(pokemon);
  } catch (error) {
    console.error("Error:", error);

    pokemonDetails.innerHTML = `
      <p>Unable to load Pokémon details.
      The data may not be cached yet.</p>
    `;
  }
}

function renderPokemonDetails(pokemon) {
  const image =
    pokemon.sprites.other["official-artwork"].front_default ||
    pokemon.sprites.front_default;

  const types = pokemon.types
  .map((item) => {
    const type = item.type.name;

    return `
      <span class="details-type type-${type}">
        ${type}
      </span>
    `;
  })
  .join("");

  const abilities = pokemon.abilities
    .map((item) => {
      return `<span class="ability-item">${item.ability.name}</span>`;
    })
    .join("");

  const stats = pokemon.stats
    .map((item) => {
      const statName = item.stat.name;
      const statValue = item.base_stat;

      const percentage = Math.min((statValue / 255) * 100, 100);

      return `
        <div class="stat-row">
          <span class="stat-name">${statName}</span>

          <div class="stat-bar">
            <div
              class="stat-fill"
              style="width: ${percentage}%"
            ></div>
          </div>

          <span class="stat-value">${statValue}</span>
        </div>
      `;
    })
    .join("");

  pokemonDetails.innerHTML = `
    <div class="details-header">
      <p class="details-number">
        #${String(pokemon.id).padStart(3, "0")}
      </p>
      
      <img
        class="details-image"
        src="${image || ""}"
        alt="${pokemon.name}"
      >

      <h2 class="details-name">${pokemon.name}</h2>

      <div class="details-types">
        ${types}
      </div>
    </div>

    <div class="details-physical">
      <div class="physical-item">
        <p>Height</p>
        <h4>${pokemon.height / 10} m</h4>
      </div>

      <div class="physical-item">
        <p>Weight</p>
        <h4>${pokemon.weight / 10} kg</h4>
      </div>
    </div>

    <section class="details-section">
      <h3>Abilities</h3>

      <div class="ability-list">
        ${abilities}
      </div>
    </section>

    <section class="details-section">
      <h3>Base Stats</h3>
    
      ${stats}
    </section>
    
    <div class="pokemon-navigation">
      <button
        type="button"
        class="pokemon-nav-button"
        data-direction="-1"
        ${pokemon.id <= 1 ? "disabled" : ""}
      >
        Previous
      </button>
      <button
        type="button"
        class="favorite-button details-favorite-button ${
          favorites.includes(pokemon.id) ? "is-favorite" : ""
        }"
        aria-label="${
          favorites.includes(pokemon.id)
            ? "Remove from favorites"
            : "Add to favorites"
        }"
        aria-pressed="${favorites.includes(pokemon.id)}"
      >
        ${favorites.includes(pokemon.id) ? "♥" : "♡"}
      </button>
      <button
        type="button"
        class="pokemon-nav-button"
        data-direction="1"
        ${pokemon.id >= allPokemon.length ? "disabled" : ""}
      >
        Next
      </button>
    </div>
  `;
}


closeDialog.addEventListener("click", () => {
  pokemonDialog.close();
});

pokemonDialog.addEventListener("click", (event) => {
  if (event.target === pokemonDialog) {
    pokemonDialog.close();
  }
});

// ========================================
// 14. FAVORITES MANAGEMENT
// ========================================

async function loadFavorites() {
  favorites = await db.favorites.toCollection().primaryKeys();

  updateFavoritesButton();
}

function updateFavoritesButton() {
  const count = favorites.length;

  favoritesFilter.textContent = showingFavorites
    ? `♥ Show All (${count})`
    : `♡ Favorites (${count})`;
}

async function toggleFavorite(pokemonId) {
  if (favorites.includes(pokemonId)) {
    await db.favorites.delete(pokemonId);
  } else {
    await db.favorites.put({
      id: pokemonId,
    });
  }

  // Update the saved favorites.
  await loadFavorites();

  // Update only the affected heart button.
  const card = pokemonGrid.querySelector(
    `[data-pokemon-id="${pokemonId}"]`
  );

  if (card) {
    const button = card.querySelector(".favorite-button");
    const isFavorite = favorites.includes(pokemonId);

    button.classList.toggle("is-favorite", isFavorite);

    button.textContent = isFavorite ? "♥" : "♡";

    button.setAttribute(
      "aria-label",
      isFavorite ? "Remove from favorites" : "Add to favorites"
    );

    button.setAttribute("aria-pressed", String(isFavorite));
  }

  // Refresh the grid only when viewing favorites.
  if (showingFavorites) {
    await filterPokemon();
  }
}

// ========================================
// 15. POKEMON GRID CLICK EVENTS
// ========================================

pokemonGrid.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest(".favorite-button");

  if (favoriteButton) {
    event.stopPropagation();

    const card = favoriteButton.closest(".pokemon-card");
    const pokemonId = Number(card.dataset.pokemonId);

    toggleFavorite(pokemonId);
    return;
  }

  const card = event.target.closest(".pokemon-card");

  if (!card) return;

  const pokemonId = card.dataset.pokemonId;

  openPokemonDetails(pokemonId);
});

// ========================================
// 16. FAVORITES FILTER BUTTON
// ========================================

favoritesFilter.addEventListener("click", async () => {
  showingFavorites = !showingFavorites;

  updateFavoritesButton();

  favoritesFilter.setAttribute(
    "aria-pressed",
    String(showingFavorites)
  );

  await filterPokemon();
});

// ========================================
// 17. INITIALIZE THE APP
// ========================================

async function initializeApp() {
  try {
    await loadFavorites();
    await getPokemon();
  } catch (error) {
    console.error("Unable to initialize Pokédex:", error);

    pokemonGrid.innerHTML = `
      <p>Unable to initialize the Pokédex.
      Please check your connection or reload the app.</p>
    `;
  }
}

const currentYear = document.querySelector("#current-year");

if (currentYear) {
  currentYear.textContent = new Date().getFullYear();
}

initializeApp();