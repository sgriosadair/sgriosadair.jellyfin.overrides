if (typeof GM_xmlhttpRequest === 'undefined') {
  const PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest='
  ];
  const DIRECT_DOMAINS = [
    'api.mdblist.com',
    'graphql.anilist.co',
    'query.wikidata.org',
    'www.google.com'
  ];

  window.GM_xmlhttpRequest = function({ method = 'GET', url, headers = {}, data, onload, onerror }) {
    const isDirect = DIRECT_DOMAINS.some(d => url.includes(d));
    let fetchUrl;
    if (isDirect) {
      fetchUrl = url;
    } else {
      const proxy = PROXIES[Math.floor(Math.random() * PROXIES.length)];
      const sep = url.includes('?') ? '&' : '?';
      const bump = `_=${Date.now()}`;
      fetchUrl = proxy + encodeURIComponent(url + sep + bump);
    }

    fetch(fetchUrl, {
      method,
      headers,
      body: data,
      cache: 'no-store'
    })
    .then(response =>
      response.text().then(text =>
        onload({ status: response.status, responseText: text })
      )
    )
    .catch(err => {
      if (typeof onerror === 'function') onerror(err);
    });
  };
}

;(function() {
  'use strict';

  // === API Keys ===
  const MDBLIST_API_KEY    = 'vrco399cynkxnzfvksgmv3vn4';

  // === Logos ===
  const LOGO = {
    imdb:               'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/IMDb.png',
    tmdb:               'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/TMDB.png',
    tomatoes:           'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/Rotten_Tomatoes.png',
    tomatoes_rotten:    'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/Rotten_Tomatoes_rotten.png',
    tomatoes_certified: 'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/rotten-tomatoes-certified.png',
    audience:           'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/Rotten_Tomatoes_positive_audience.png',
    audience_rotten:    'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/Rotten_Tomatoes_negative_audience.png',
    rotten_ver:         'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/roten_tomatoes_ver.png',
    metacritic:         'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/Metacritic.png',
    metacriticms:       'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/metacriticms.png',
    metacriticus:       'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/mus2.png',
    trakt:              'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/Trakt.png',
    myanimelist:        'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/mal.png',
    anilist:            'https://cdn.jsdelivr.net/gh/Druidblack/jellyfin_ratings@main/logo/anilist.png'
  };

  let currentImdbId = null;
  scanLinks();
  setInterval(scanLinks, 1000);

  function scanLinks() {
    document.querySelectorAll('a.emby-button[href*="imdb.com/title/"]').forEach(a => {
      if (a.dataset.imdbProcessed) return;
      a.dataset.imdbProcessed = 'true';
      const m = a.href.match(/imdb\.com\/title\/(tt\d+)/);
      currentImdbId = m ? m[1] : null;
      document.querySelectorAll('.mdblist-rating-container').forEach(el => el.remove());
    });

    document.querySelectorAll(
      'div.starRatingContainer.mediaInfoItem, div.mediaInfoItem.mediaInfoCriticRating'
    ).forEach(el => {
      el.style.color = 'transparent';
      el.style.fontSize = '0';
    });

    document.querySelectorAll('a.emby-button[href*="themoviedb.org/"]').forEach(a => {
      if (a.dataset.mdblistProcessed) return;
      a.dataset.mdblistProcessed = 'true';
      processLink(a);
    });
  }

  function processLink(link) {
    const m = link.href.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
    if (!m) return;
    const type   = m[1] === 'tv' ? 'show' : 'movie';
    const tmdbId = m[2];
    const spots = document.querySelectorAll('div.mediaInfoItem.mediaInfoText.mediaInfoOfficialRating');
    if (spots.length) {
      spots.forEach(el => insert(el, type, tmdbId));
    } else {
      document.querySelectorAll('div.mediaInfoItem').forEach(el => {
        if (/^\d+.*m$/i.test(el.textContent.trim())) {
          insert(el, type, tmdbId);
        }
      });
    }
  }

  function insert(target, type, tmdbId) {
    while (target.nextElementSibling?.classList.contains('mdblist-rating-container')) {
      target.nextElementSibling.remove();
    }
    const container = document.createElement('div');
    container.className = 'mdblist-rating-container';
    container.style.cssText = 'display:inline-flex; align-items:center; margin-left:6px;';
    target.insertAdjacentElement('afterend', container);

    fetchMDBList(type, tmdbId, container);

    if (currentImdbId) {
      fetchRTCertified(currentImdbId, certified => {
        if (certified) {
          const img = container.querySelector('img[data-source="tomatoes"]');
          if (img) img.src = LOGO.tomatoes_certified;
        }
      });
      fetchRTAudienceCertified(currentImdbId, positive => {
        if (positive) {
          const img = container.querySelector('img[data-source="audience"]');
          if (img) img.src = LOGO.rotten_ver;
        }
      });
      fetchMCMustSee(currentImdbId, mustSee => {
        if (mustSee) {
          const img = container.querySelector('img[data-source="metacritic"]');
          if (img) img.src = LOGO.metacriticms;
        }
      });
    }
  }

  // === MDBList ===
  function fetchMDBList(type, tmdbId, container) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.mdblist.com/tmdb/${type}/${tmdbId}?apikey=${MDBLIST_API_KEY}`,
      onload(res) {
        if (res.status !== 200) return console.warn('MDBList status:', res.status);
        let data;
        try { data = JSON.parse(res.responseText); }
        catch (e) { return console.error('MDBList JSON parse error:', e); }

        container.dataset.originalTitle = data.original_title || data.title || '';
        container.dataset.year          = data.year || '';

        if (Array.isArray(data.ratings)) {
          data.ratings.forEach(r => {
            if (r.value == null) return;
            let key = r.source.toLowerCase().replace(/\s+/g, '_');
            if (key === 'tomatoes') key = r.value < 60 ? 'tomatoes_rotten' : 'tomatoes';
            else if (key.includes('popcorn')) key = r.value < 60 ? 'audience_rotten' : 'audience';
            else if (key.includes('metacritic') && !key.includes('user')) key = 'metacritic';
            else if (key.includes('metacritic') && key.includes('user')) key = 'metacriticus';
            else if (key.includes('trakt')) key = 'trakt';
            else if (key.includes('myanimelist')) key = 'myanimelist';

            const logoUrl = LOGO[key];
            if (!logoUrl) return;

            const img = document.createElement('img');
            img.src = logoUrl;
            img.alt = r.source;
            img.title = `${r.source}: ${r.value}`;
            img.dataset.source = key;
            img.style.cssText = 'height:1.5em; margin-right:4px; vertical-align:middle;';
            container.appendChild(img);

            const span = document.createElement('span');
            span.textContent = r.value;
            span.style.cssText = 'margin-right:8px; font-size:1em; vertical-align:middle;';
            container.appendChild(span);
          });
        }

        if (currentImdbId) {
          fetchAniListRating(currentImdbId, container);
        }

        const title = container.dataset.originalTitle;
        const year  = parseInt(container.dataset.year, 10);
        if (title && year) {
          fetchKinopoiskRating(title, year, type, container);
        }
      }
    });
  }

  // === AniList integration ===
  function getAnilistId(imdbId, cb) {
    const sparql = `
      SELECT ?anilist WHERE {
        ?item wdt:P345 "${imdbId}" .
        ?item wdt:P8729 ?anilist .
      } LIMIT 1`;
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
      onload(res) {
        if (res.status !== 200) return cb(null);
        let json;
        try { json = JSON.parse(res.responseText); }
        catch { return cb(null); }
        const b = json.results.bindings;
        cb(b.length && b[0].anilist?.value ? b[0].anilist.value : null);
      },
      onerror: () => cb(null)
    });
  }

  function fetchAniListRating(imdbId, container) {
    getAnilistId(imdbId, id => {
      if (id) {
        queryAniListById(id, container);
      } else {
        const title = container.dataset.originalTitle;
        const year  = parseInt(container.dataset.year, 10);
        if (title && year) queryAniListBySearch(title, year, container);
      }
    });
  }

  function queryAniListById(id, container) {
    const query = `
      query($id:Int){
        Media(id:$id,type:ANIME){
          id meanScore
        }
      }`;
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://graphql.anilist.co',
      headers: {'Content-Type':'application/json'},
      data: JSON.stringify({ query, variables: { id: parseInt(id, 10) } }),
      onload(res) {
        if (res.status !== 200) return;
        let json;
        try { json = JSON.parse(res.responseText); }
        catch { return; }
        const m = json.data?.Media;
        if (m?.meanScore > 0) appendAniList(container, m.id, m.meanScore);
      }
    });
  }

  function queryAniListBySearch(title, year, container) {
    const query = `
      query($search:String,$startDate:FuzzyDateInt,$endDate:FuzzyDateInt){
        Media(
          search:$search,
          type:ANIME,
          startDate_greater:$startDate,
          startDate_lesser:$endDate
        ){
          id meanScore title { romaji english native } startDate { year }
        }
      }`;
    const vars = {
      search:    title,
      startDate: parseInt(`${year}0101`, 10),
      endDate:   parseInt(`${year+1}0101`, 10)
    };
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://graphql.anilist.co',
      headers: {'Content-Type':'application/json'},
      data: JSON.stringify({ query, variables: vars }),
      onload(res) {
        if (res.status !== 200) return;
        let json;
        try { json = JSON.parse(res.responseText); }
        catch { return; }
        const m = json.data?.Media;
        if (m?.meanScore > 0 && m.startDate?.year === year) {
          const norm = s => s.toLowerCase().trim();
          const t0 = norm(title);
          const titles = [m.title.romaji, m.title.english, m.title.native]
            .filter(Boolean).map(norm);
          if (titles.includes(t0)) appendAniList(container, m.id, m.meanScore);
        }
      }
    });
  }

  function appendAniList(container, mediaId, score) {
    const img = document.createElement('img');
    img.src = LOGO.anilist;
    img.alt = 'AniList';
    img.title = `AniList: ${score}`;
    img.dataset.source = 'anilist';
    img.style.cssText = 'height:1.5em; margin-right:4px; vertical-align:middle;';
    container.appendChild(img);

    const span = document.createElement('span');
    span.textContent = score;
    span.style.cssText = 'margin-right:8px; font-size:1em; vertical-align:middle;';
    container.appendChild(span);
  }

  // === Rotten Tomatoes certified critics ===
  function fetchRTCertified(imdbId, cb) {
    const sparql = `
      SELECT ?rtid WHERE {
        ?item wdt:P345 "${imdbId}" .
        ?item wdt:P1258 ?rtid .
      } LIMIT 1`;
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
      onload(res) {
        if (res.status !== 200) return cb(false);
        let json;
        try { json = JSON.parse(res.responseText); } catch { return cb(false); }
        const b = json.results.bindings;
        if (!b.length || !b[0].rtid.value) return cb(false);
        const id = b[0].rtid.value;
        const rtUrl = id.startsWith('http') ? id : 'https://www.rottentomatoes.com/' + id;
        GM_xmlhttpRequest({
          method: 'GET',
          url: rtUrl,
          onload(r) {
            if (r.status !== 200) return cb(false);
            const m = r.responseText.match(/<script\s+id="media-scorecard-json"[^>]*>([\s\S]*?)<\/script>/);
            if (!m) return cb(false);
            let obj;
            try { obj = JSON.parse(m[1]); } catch { return cb(false); }
            cb(!!(obj.criticsScore && obj.criticsScore.certified));
          },
          onerror: () => cb(false)
        });
      },
      onerror: () => cb(false)
    });
  }

  // === Rotten Tomatoes positive audience ===
  function fetchRTAudienceCertified(imdbId, cb) {
    const sparql = `
      SELECT ?rtid WHERE {
        ?item wdt:P345 "${imdbId}" .
        ?item wdt:P1258 ?rtid .
      } LIMIT 1`;
    GM_xmlhttpRequest({
      method: 'GET',
      url: 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql),
      onload(res) {
        if (res.status !== 200) return cb(false);
        let json;
        try { json = JSON.parse(res.responseText); } catch { return cb(false); }
        const b = json.results.bindings;
        if (!b.length || !b[0].rtid.value) return cb(false);
        const id = b[0].rtid.value;
        const rtUrl = id.startsWith('http') ? id : 'https://www.rottentomatoes.com/' + id;
        GM_xmlhttpRequest({
          method: 'GET',
          url: rtUrl,
          onload(r) {
            if (r.status !== 200) return cb(false);
            const m = r.responseText.match(/<script\s+id="media-scorecard-json"[^>]*>([\s\S]*?)<\/script>/);
            if (!m) return cb(false);
            const jsonStr = m[1];
            cb(jsonStr.includes('POSITIVE","certified":true'));
          },
          onerror: () => cb(false)
        });
      },
      onerror: () => cb(false)
    });
  }

  // === Metacritic must-see ===
  function fetchMCMustSee(imdbId, cb) {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `https://www.imdb.com/title/${imdbId}/criticreviews`,
      onload(res) {
        const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
        const row = doc.querySelector('[data-testid="critic-reviews-title"]');
        if (!row) return cb(false);
        const ch   = Array.from(row.children);
        const crit = parseInt(ch[0]?.textContent.trim(), 10) || 0;
        const cnt  = parseInt(ch[1]?.children[1]?.textContent.trim().split(' ')[0], 10) || 0;
        cb(crit > 80 && cnt > 14);
      },
      onerror: () => cb(false)
    });
  }

})();
