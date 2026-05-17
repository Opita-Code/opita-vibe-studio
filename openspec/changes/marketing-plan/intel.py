"""
Opita Marketing Intelligence Toolkit
=====================================
Módulo de inteligencia competitiva que aprovecha las técnicas anti-detección
de Scrapling (BSD-3) para recopilar datos de marketing de forma indetectable.

Técnicas anti-detección adoptadas:
1. Patchright (Playwright parcheado) — elimina puntos de detección del navegador
2. browserforge — genera fingerprints realistas (UA, headers, TLS)
3. curl_cffi — impersona TLS fingerprints de Chrome/Firefox reales
4. 40+ flags de Chromium stealth — desactivan señales de automatización
5. Cloudflare Turnstile solver — resuelve captchas automáticamente
6. DNS-over-HTTPS — previene DNS leaks al usar proxies
7. Canvas noise injection — previene fingerprinting por canvas
8. WebRTC blocking — previene leaks de IP local
9. Google referer spoofing — simula tráfico orgánico desde Google
10. Resource blocking — bloquea ads/trackers (~3,500 dominios conocidos)

Uso:
    python intel.py competitors   # Analizar landings de competidores
    python intel.py keywords      # Investigar SERPs para keywords objetivo
    python intel.py directories   # Scraping de directorios de lanzamiento
    python intel.py universities  # Extraer contactos de universidades
"""

import json
import sys
import os
from datetime import datetime

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

COMPETITORS = {
    "cursor": "https://www.cursor.com/",
    "bolt": "https://bolt.new/",
    "windsurf": "https://windsurf.com/",
    "lovable": "https://lovable.dev/",
    "replit": "https://replit.com/",
}

KEYWORDS = [
    "IDE con inteligencia artificial",
    "vibe coding español",
    "crear aplicaciones con IA",
    "alternativa a cursor español",
    "programar sin saber código",
    "bolt.new en español",
    "IDE estudiantes Colombia",
    "herramientas IA para programadores",
    "aprender a programar con IA",
    "no code Colombia",
]

UNIVERSITIES = [
    {"name": "USCO", "url": "https://www.usco.edu.co/es/programas/ingenieria-de-software/"},
    {"name": "Corhuila", "url": "https://www.corhuila.edu.co/"},
    {"name": "UNAD", "url": "https://www.unad.edu.co/"},
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data", "intel")
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================================
# MÓDULO DE SCRAPING STEALTH (usando Scrapling)
# ============================================================================

def stealth_fetch(url, solve_cf=False, block_ads=True):
    """
    Fetch una URL de forma completamente indetectable.
    
    Usa las técnicas de anti-detección de Scrapling:
    - Patchright (Playwright parcheado sin automation flags)
    - Fingerprint spoofing via browserforge
    - Google referer para simular tráfico orgánico
    - Canvas noise para evitar fingerprinting
    - WebRTC blocking para evitar leaks de IP
    - DNS-over-HTTPS para evitar DNS leaks
    """
    from scrapling.fetchers import StealthyFetcher
    
    return StealthyFetcher.fetch(
        url,
        headless=True,
        network_idle=True,
        block_ads=block_ads,
        solve_cloudflare=solve_cf,
        hide_canvas=True,
        block_webrtc=True,
        dns_over_https=True,
        google_search=True,  # Simula que vienes de Google
    )


def fast_fetch(url, impersonate="chrome"):
    """
    Fetch rápido vía HTTP (sin navegador) con TLS fingerprint de Chrome.
    Usa curl_cffi para impersonar el handshake TLS de un navegador real.
    """
    from scrapling.fetchers import Fetcher
    return Fetcher.get(url, stealthy_headers=True, impersonate=impersonate)


# ============================================================================
# COMANDOS DE INTELIGENCIA
# ============================================================================

def analyze_competitors():
    """Analiza las landings de competidores directos: copy, pricing, features, SEO."""
    print("🔍 Analizando competidores de Vibe Studio...\n")
    results = {}
    
    for name, url in COMPETITORS.items():
        print(f"  → Scraping {name} ({url})...")
        try:
            page = stealth_fetch(url, solve_cf=True)
            
            # Extraer datos de marketing
            title = page.css("title::text").get() or ""
            description = page.css('meta[name="description"]::attr(content)').get() or ""
            h1 = page.css("h1::text").get() or ""
            h2s = page.css("h2::text").getall()[:5]
            
            # Extraer textos de CTAs (botones)
            ctas = page.css("a.btn::text, button::text, a[class*='button']::text, a[class*='cta']::text").getall()
            ctas = [c.strip() for c in ctas if c.strip()][:5]
            
            # Extraer pricing si existe
            pricing_text = page.css("[class*='price'], [class*='pricing'], [id*='price']").css("::text").getall()
            pricing_text = [p.strip() for p in pricing_text if p.strip() and any(c.isdigit() for c in p)][:10]
            
            # Extraer features
            features = page.css("li::text, [class*='feature']::text").getall()
            features = [f.strip() for f in features if f.strip() and len(f.strip()) > 10][:15]
            
            results[name] = {
                "url": url,
                "title": title,
                "meta_description": description,
                "h1": h1,
                "h2s": h2s,
                "ctas": ctas,
                "pricing_mentions": pricing_text,
                "key_features": features,
                "scraped_at": datetime.now().isoformat(),
            }
            print(f"    ✅ {name}: '{h1}' | {len(features)} features detectados")
            
        except Exception as e:
            print(f"    ❌ Error con {name}: {e}")
            results[name] = {"url": url, "error": str(e)}
    
    # Guardar resultados
    output_file = os.path.join(OUTPUT_DIR, "competitors.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 Resultados guardados en: {output_file}")
    return results


def research_keywords():
    """Investiga los resultados de Google para las keywords objetivo."""
    print("🔍 Investigando SERPs para keywords de Vibe Studio...\n")
    results = {}
    
    for keyword in KEYWORDS:
        print(f"  → Buscando: '{keyword}'...")
        try:
            search_url = f"https://www.google.com/search?q={keyword.replace(' ', '+')}&hl=es&gl=co"
            page = stealth_fetch(search_url, solve_cf=False)
            
            # Extraer resultados orgánicos
            organic = []
            for result in page.css("div.g, div[data-hveid]")[:10]:
                title = result.css("h3::text").get() or ""
                link = result.css("a::attr(href)").get() or ""
                snippet = result.css("div[data-sncf]::text, span::text").get() or ""
                if title and link.startswith("http"):
                    organic.append({"title": title, "url": link, "snippet": snippet[:200]})
            
            results[keyword] = {
                "query": keyword,
                "results_count": len(organic),
                "top_results": organic,
                "our_position": next(
                    (i+1 for i, r in enumerate(organic) if "opitacode" in r.get("url", "").lower()),
                    None
                ),
                "scraped_at": datetime.now().isoformat(),
            }
            
            position = results[keyword]["our_position"]
            pos_str = f"Posición #{position}" if position else "No aparece"
            print(f"    ✅ {len(organic)} resultados | opitacode.com: {pos_str}")
            
        except Exception as e:
            print(f"    ❌ Error: {e}")
            results[keyword] = {"query": keyword, "error": str(e)}
    
    output_file = os.path.join(OUTPUT_DIR, "serp_research.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 Resultados guardados en: {output_file}")
    return results


def scrape_directories():
    """Scraping de directorios donde podemos publicar Vibe Studio."""
    print("🔍 Recopilando directorios de lanzamiento...\n")
    try:
        page = fast_fetch("https://launchdirectories.com/")
        directories = []
        
        for item in page.css("a[href]"):
            href = item.attrib.get("href", "")
            text = item.css("::text").get() or ""
            if href.startswith("http") and text.strip() and "launchdirectories" not in href:
                directories.append({"name": text.strip(), "url": href})
        
        # Deduplicate
        seen = set()
        unique = []
        for d in directories:
            if d["url"] not in seen:
                seen.add(d["url"])
                unique.append(d)
        
        output_file = os.path.join(OUTPUT_DIR, "launch_directories.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(unique, f, ensure_ascii=False, indent=2)
        
        print(f"✅ {len(unique)} directorios encontrados")
        print(f"📄 Guardados en: {output_file}")
        return unique
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []


def scrape_universities():
    """Extrae información de contacto de universidades del Huila."""
    print("🔍 Extrayendo información de universidades...\n")
    results = {}
    
    for uni in UNIVERSITIES:
        print(f"  → Scraping {uni['name']}...")
        try:
            page = fast_fetch(uni["url"])
            
            # Extraer correos electrónicos
            import re
            page_text = page.css("body").get() or ""
            emails = list(set(re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', page_text)))
            
            # Extraer teléfonos
            phones = list(set(re.findall(r'[\+]?[\d\s\-\(\)]{7,15}', page_text)))
            phones = [p.strip() for p in phones if len(p.strip()) >= 7][:5]
            
            results[uni["name"]] = {
                "url": uni["url"],
                "emails": emails[:10],
                "phones": phones,
                "scraped_at": datetime.now().isoformat(),
            }
            print(f"    ✅ {len(emails)} emails, {len(phones)} teléfonos encontrados")
            
        except Exception as e:
            print(f"    ❌ Error: {e}")
            results[uni["name"]] = {"url": uni["url"], "error": str(e)}
    
    output_file = os.path.join(OUTPUT_DIR, "universities.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n📄 Resultados guardados en: {output_file}")
    return results


# ============================================================================
# CLI
# ============================================================================

COMMANDS = {
    "competitors": ("Analizar landings de competidores", analyze_competitors),
    "keywords": ("Investigar SERPs para keywords objetivo", research_keywords),
    "directories": ("Scraping de directorios de lanzamiento", scrape_directories),
    "universities": ("Extraer contactos de universidades", scrape_universities),
}

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print("🚀 Opita Marketing Intelligence Toolkit")
        print("=" * 45)
        print("\nComandos disponibles:")
        for cmd, (desc, _) in COMMANDS.items():
            print(f"  python intel.py {cmd:15s} — {desc}")
        print()
        return
    
    cmd = sys.argv[1]
    desc, func = COMMANDS[cmd]
    print(f"\n🚀 Opita Marketing Intelligence — {desc}")
    print("=" * 55)
    func()


if __name__ == "__main__":
    main()
