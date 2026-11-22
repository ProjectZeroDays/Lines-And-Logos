/* Lines & Logos — analytics consent gate.
   Default state: NO analytics load. Only after explicit opt-in does the loader
   inject the configured provider. Persisted in localStorage ('ll_analytics_consent').
   Drop analytics IDs into data-attributes on the script tag:
     <script defer src="assets/consent.js" data-measurement-id="G-XXXXXXX"></script>
   No ID configured → banner still educates, opt-in records preference only. */
(function(){
  var KEY = 'll_analytics_consent';
  var script = document.currentScript || (function(){ var s = document.getElementsByTagName('script'); return s[s.length-1]; })();
  var MEASUREMENT_ID = script && script.getAttribute('data-measurement-id');
  var loaded = false;

  function consent(){ try { return localStorage.getItem(KEY); } catch(e){ return null; } }
  function setConsent(v){ try { localStorage.setItem(KEY, v); } catch(e){} }

  function loadAnalytics(){
    if (loaded) return; loaded = true;
    if (!MEASUREMENT_ID) return; // preference recorded; nothing to inject until an ID is configured
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { anonymize_ip: true });
  }

  function dismiss(){ var b = document.getElementById('ll-consent'); if (b) b.remove(); }

  function banner(){
    if (document.getElementById('ll-consent')) return;
    var el = document.createElement('div');
    el.id = 'll-consent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Analytics consent');
    el.innerHTML =
      '<p>We use privacy-friendly analytics to improve the site — only if you opt in. ' +
      '<a href="legal.html#privacy">Privacy Policy</a></p>' +
      '<div class="ll-consent-btns">' +
      '<button id="ll-consent-no" class="ll-btn ghost">No thanks</button>' +
      '<button id="ll-consent-yes" class="ll-btn">Accept</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('ll-consent-yes').addEventListener('click', function(){ setConsent('granted'); loadAnalytics(); dismiss(); });
    document.getElementById('ll-consent-no').addEventListener('click', function(){ setConsent('denied'); dismiss(); });
  }

  function init(){
    var c = consent();
    if (c === 'granted') loadAnalytics();
    else if (c !== 'denied') banner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
