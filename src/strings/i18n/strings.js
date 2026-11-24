// One file per language; scripts/bundle.mjs inlines them back into a single object literal at build, which
// scripts/i18n-split.mjs then splits per language (English stays in the bundle).
import en from "./en.js";
import fr from "./fr.js";
import de from "./de.js";
import es from "./es.js";
import sr from "./sr.js";
import srLatn from "./sr-Latn.js";
import it from "./it.js";
import nl from "./nl.js";
import pt from "./pt.js";
import pl from "./pl.js";
import ro from "./ro.js";
import da from "./da.js";
import sv from "./sv.js";
import bg from "./bg.js";
import ru from "./ru.js";
import uk from "./uk.js";
import hu from "./hu.js";
import sk from "./sk.js";
import cs from "./cs.js";
import sl from "./sl.js";
import lv from "./lv.js";
import el from "./el.js";

// Texts of the cards, by language. English is the source; every other language is moved to its own file by the
// build (scripts/i18n-split.mjs) and fetched when a card needs it. Plural forms: `<key>_<category>` of
// Intl.PluralRules, the `_other` form when a language has no text for a category.
export const STRINGS = {
  en,
  fr,
  de,
  es,
  sr,
  "sr-Latn": srLatn,
  it,
  nl,
  pt,
  pl,
  ro,
  da,
  sv,
  bg,
  ru,
  uk,
  hu,
  sk,
  cs,
  sl,
  lv,
  el,
};
