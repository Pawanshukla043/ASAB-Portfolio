// const API_URL = "https://script.google.com/macros/s/AKfycbx53c-qnxjUMB_T5p8xZrxaMvXxATvDW5rxjUbIqp9p0mA7oJGrxyB8MH0-4IMvJq9Piw/exec";
const API_URL = "https://script.google.com/macros/s/AKfycbyN9F8GOArqcGoWncE21YkITdBEEezpmwymdto7z-xMRQt2XhVCHOrS-zr1BoDQ_13y/exec";
// const API_URL = "my_api_url";

let slideIndex = 0;
let totalSlides = 0;
let shortsSwiper = null;

async function loadContent() {
  const res = await fetch(API_URL);
  const data = await res.json();

  /* ================= SETTINGS ================= */

  const s = data.settings;

  document.getElementById("hero_title").innerText = s.hero_title || "";
  document.getElementById("hero_tagline").innerText = s.hero_tagline || "";

  const heroBtn = document.getElementById("hero_button");
  heroBtn.innerText = s.hero_button_text || "";
  heroBtn.href = s.hero_button_link || "#";

  document.getElementById("about_heading").innerHTML = s.about_heading || "";
  document.getElementById("about_para_1").innerText = s.about_para_1 || "";
  document.getElementById("about_para_2").innerText = s.about_para_2 || "";

  document.getElementById("contact_email").innerText = s.contact_email || "";
  document.getElementById("contact_phone").innerText = s.contact_phone || "";

  document.getElementById("album_title").innerHTML = s.album_title || "";
  document.getElementById("album_description").innerText = s.album_description || "";
  document.getElementById("album_button").innerText = s.album_button_text || "Listen Now";
  document.getElementById("album_button").href = s.album_button_link || "#";

  document.getElementById("vision_heading").innerHTML = s.vision_heading || "";
  document.getElementById("vision_text").innerText = s.vision_text || "";

/* ================= JOURNEY ================= */

const journeyContainer = document.getElementById("journey_slides");

if (journeyContainer && Array.isArray(data.journey)) {

  journeyContainer.innerHTML = data.journey.map(item => `
    <div class="slide" style="background-image:url('/img/${item.image}')">
      <h3>${item.year}</h3>
      <p>${item.description}</p>
    </div>
  `).join("");

  // IMPORTANT: count only journey slides
  totalSlides = journeyContainer.querySelectorAll(".slide").length;

  // Reset position
  slideIndex = 0;

  // Force proper width calculation after DOM render
  setTimeout(initSlider, 100);
}

  /* ================= STATS ================= */

  const statsContainer = document.getElementById("stats_container");
  statsContainer.innerHTML = "";

  data.stats.forEach(stat => {
    statsContainer.innerHTML += `
      <div class="card">
        <h3>${stat.number}</h3>
        <p>${stat.label}</p>
      </div>
    `;
  });

  /* ================= GOALS ================= */

  const goalsContainer = document.querySelector('.goal-cards');
  if (goalsContainer && Array.isArray(data.goals)) {
    goalsContainer.innerHTML = data.goals.map(goal => `
      <div class="goal">
        <h3>${goal.title}</h3>
        <p>${goal.description}</p>
      </div>
    `).join('');
  }

  /* ================= MUSIC ================= */

  const albumContainer = document.getElementById("album_iframe");
  const singlesContainer = document.getElementById("singles_container");

  albumContainer.innerHTML = "";
  singlesContainer.innerHTML = "";

  data.music_iframes.forEach(item => {
    if (item.type === "album") {
      albumContainer.innerHTML = item.embed_code;
    } else {
      singlesContainer.innerHTML += item.embed_code;
    }
  });

  /* ================= VIDEOS ================= */

  const videoBento = document.getElementById("video_bento");

  if (videoBento && data.videos) {

    const v = data.videos;

    function getYoutubeId(url) {
      if (!url) return null;
      const regExp = /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([^?&/]+)/;
      const match = url.match(regExp);
      return match ? match[1] : null;
    }

    function createYoutubeThumbnail(url) {
      const id = getYoutubeId(url);
      if (!id) return "";
      return `
        <div class="video-wrapper" data-video-id="${id}">
          <img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" 
               onerror="this.src='https://img.youtube.com/vi/${id}/0.jpg'" 
               alt="Video thumbnail" 
               class="video-thumb">
        </div>
      `;
    }

    videoBento.innerHTML = `
      <div class="bento-item feature-video">
          ${createYoutubeThumbnail(v.video_feature_embed)}
          <div class="v-label">FEATURED RELEASE</div>
      </div>

      <div class="bento-item">${createYoutubeThumbnail(v.video_1_embed)}</div>
      <div class="bento-item">${createYoutubeThumbnail(v.video_2_embed)}</div>
      <div class="bento-item">${createYoutubeThumbnail(v.video_3_embed)}</div>
      <div class="bento-item">${createYoutubeThumbnail(v.video_4_embed)}</div>
      <div class="bento-item">${createYoutubeThumbnail(v.video_5_embed)}</div>
    `;

    // Hover effect with auto-play
    const bentoItems = videoBento.querySelectorAll('.bento-item');
    bentoItems.forEach(item => {
      const wrapper = item.querySelector('.video-wrapper');
      if (!wrapper) return;

      item.addEventListener('mouseenter', () => {
        videoBento.classList.add('has-hover');
        item.classList.add('hovered');
        
        // Pause swiper
        if (shortsSwiper && shortsSwiper.autoplay) {
          shortsSwiper.autoplay.stop();
        }

        // Inject iframe
        const videoId = wrapper.dataset.videoId;
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0`;
        iframe.allow = 'autoplay';
        iframe.style.opacity = '0';
        wrapper.appendChild(iframe);
        
        setTimeout(() => iframe.style.opacity = '1', 100);
      });

      item.addEventListener('mouseleave', () => {
        videoBento.classList.remove('has-hover');
        item.classList.remove('hovered');
        
        // Resume swiper
        if (shortsSwiper && shortsSwiper.autoplay) {
          shortsSwiper.autoplay.start();
        }

        // Remove iframe
        const iframe = wrapper.querySelector('iframe');
        if (iframe) iframe.remove();
      });
    });
  }

  /* ================= SHORTS + REELS ================= */

  const shortsContainer = document.getElementById("shorts_container");

  if (shortsContainer && Array.isArray(data.shorts)) {

    let html = "";

    function getYoutubeId(url) {
      if (!url) return null;
      const regExp = /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([^?&/]+)/;
      const match = url.match(regExp);
      return match ? match[1] : null;
    }

    data.shorts.forEach(item => {

      let embed = "";

      /* ===== YOUTUBE SHORTS ===== */
      if (item.platform === "youtube") {
        const id = getYoutubeId(item.url);
        if (id) {
          embed = `
          <iframe 
            src="https://www.youtube.com/embed/${id}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        `;
        }
      }

      /* ===== INSTAGRAM REELS ===== */
      if (item.platform === "instagram") {

        // Clean URL (remove tracking params)
        const cleanUrl = item.url.split("?")[0];

        embed = `
        <blockquote 
          class="instagram-media"
          data-instgrm-permalink="${cleanUrl}"
          data-instgrm-version="14"
          style="background:#000; border:0; margin:0 auto; max-width:100%;">
        </blockquote>
      `;
      }

      if (embed) {
        html += `<div class="swiper-slide">${embed}</div>`;
      }
    });

    shortsContainer.innerHTML = html;

    /* IMPORTANT: Re-process Instagram embeds */
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }

    initSwiper();
  }
}

/* ================= SLIDER ================= */

function initSlider() {

  const slidesWrapper = document.querySelector("#journey_slides");
  if (!slidesWrapper) return;

  const slides = slidesWrapper.querySelectorAll(".slide");
  if (!slides.length) return;

  slidesWrapper.style.display = "flex";
  slidesWrapper.style.transition = "transform 0.6s ease";

  slideIndex = 0;

  setInterval(() => {

    slideIndex++;
    if (slideIndex >= slides.length) slideIndex = 0;

    slidesWrapper.style.transform = `translateX(-${slideIndex * 100}%)`;

  }, 4000);
}

/* ================= SWIPER ================= */

function initSwiper() {

  if (shortsSwiper) {
    shortsSwiper.destroy(true, true);
  }

  shortsSwiper = new Swiper('.shorts-swiper', {
    direction: 'vertical',
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    autoplay: {
      delay: 5000,
      disableOnInteraction: false
    },
    pagination: {
      el: '.swiper-pagination',
      clickable: true,
    },
  });
}

document.addEventListener("DOMContentLoaded", loadContent);

/* ================= SOCIAL LINKS ================= */

const socialData = [
  { name: 'Instagram', url: 'https://www.instagram.com/ytie_melody', icon: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>' },
  { name: 'YouTube', url: 'https://www.youtube.com/@YTieHipHop', icon: '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' },
  { name: 'Spotify', url: 'https://open.spotify.com/artist/2M3fd2Jxn8raB2Sirwl2YF', icon: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>' },
  { name: 'Twitter', url: 'https://twitter.com/ytie_melody', icon: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
  { name: 'Linktree', url: 'https://beacons.ai/ytiehiphop', icon: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#111111"/><g fill="#ffffff">  <rect x="11" y="4" width="2" height="9"/>  <rect x="11" y="11" width="2" height="9"/>  <rect x="4" y="11" width="9" height="2"/>  <rect x="11" y="11" width="9" height="2"/> <rect x="8" y="5" width="2" height="8" transform="rotate(-45 7.2 10.2)"/>  <rect x="14" y="5" width="2" height="8" transform="rotate(45 16.8 10.2)"/></g></svg>`}
];

function renderSocialLinks() {
  const container = document.getElementById('social_links');
  if (!container) return;
  
  container.innerHTML = socialData.map(social => 
    `<a href="${social.url}" target="_blank" title="${social.name}">${social.icon}</a>`
  ).join('');
}

renderSocialLinks();

/* ================= CONTACT FORM ================= */

const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(contactForm);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      mobile: formData.get('mobile'),
      description: formData.get('description')
    };
    
    formStatus.textContent = 'Sending...';
    formStatus.className = '';
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      console.log('Server response:', result);
      
      if (result.success) {
        formStatus.textContent = '✓ Message sent successfully!';
        formStatus.className = 'success';
        contactForm.reset();
      } else {
        formStatus.textContent = '✗ Error: ' + (result.error || 'Unknown error');
        formStatus.className = 'error';
      }
    } catch (error) {
      console.error('Form error:', error);
      formStatus.textContent = '✗ Failed to send. Please email directly.';
      formStatus.className = 'error';
    }
  });
}