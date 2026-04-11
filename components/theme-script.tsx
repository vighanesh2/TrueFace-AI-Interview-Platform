import { THEME_STORAGE_KEY } from "@/lib/theme-storage";

/** Runs before paint to set `html.dark` from localStorage + system preference. */
export function ThemeScript() {
  const js = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);var d=window.matchMedia("(prefers-color-scheme: dark)").matches;if(t==="light"){document.documentElement.classList.remove("dark");}else if(t==="dark"){document.documentElement.classList.add("dark");}else{if(d)document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
