// Traducción de nombres de equipos al español SOLO para visualización.
// El nombre en inglés sigue siendo el identificador interno (claves de
// teamsMetadata, comparación de bracket para puntajes, tablas de posiciones),
// por lo que esta capa no afecta la lógica ni requiere migración de datos.

const TEAM_NAMES_ES = {
  "Mexico": "México",
  "South Africa": "Sudáfrica",
  "Rep. of Korea": "Corea del Sur",
  "Czech Rep.": "Chequia",
  "Canada": "Canadá",
  "Bosnia/Herzegovina": "Bosnia y Herzegovina",
  "USA": "Estados Unidos",
  "Paraguay": "Paraguay",
  "Haiti": "Haití",
  "Scotland": "Escocia",
  "Brazil": "Brasil",
  "Morocco": "Marruecos",
  "Switzerland": "Suiza",
  "Qatar": "Catar",
  // El dato de origen tiene un nombre con codificación corrupta ("CuraÃ§ao").
  // Se cubren ambas variantes para traducir correctamente sin modificar el JSON.
  "CuraÃ§ao": "Curazao",
  "Curaçao": "Curazao",
  "Germany": "Alemania",
  "Ecuador": "Ecuador",
  "Ivory Coast": "Costa de Marfil",
  "Netherlands": "Países Bajos",
  "Japan": "Japón",
  "Sweden": "Suecia",
  "Tunisia": "Túnez",
  "Belgium": "Bélgica",
  "Egypt": "Egipto",
  "IR Iran": "Irán",
  "New Zealand": "Nueva Zelanda",
  "Spain": "España",
  "Saudi Arabia": "Arabia Saudita",
  "Uruguay": "Uruguay",
  "France": "Francia",
  "Senegal": "Senegal",
  "Iraq": "Irak",
  "Norway": "Noruega",
  "Argentina": "Argentina",
  "Algeria": "Argelia",
  "Austria": "Austria",
  "Jordan": "Jordania",
  "Portugal": "Portugal",
  "DR Congo": "RD Congo",
  "Uzbekistan": "Uzbekistán",
  "Colombia": "Colombia",
  "England": "Inglaterra",
  "Croatia": "Croacia",
  "Ghana": "Ghana",
  "Panama": "Panamá",
  "Australia": "Australia",
  "Turkey": "Turquía"
};

/**
 * Devuelve el nombre del equipo en español para mostrar en la interfaz.
 * Los marcadores de posición ("1A", "2B", "3-ABCDF", "Ganador K16-1",
 * "Campeón", "Subcampeón", etc.) no están en el mapa y pasan sin cambios.
 */
export function translateTeam(name) {
  if (!name) return name;
  return TEAM_NAMES_ES[name] || name;
}
