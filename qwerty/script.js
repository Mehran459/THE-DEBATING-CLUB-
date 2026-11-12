/* The Debating Club UAF - public site behaviour. */
(function () {
  "use strict";
  const PAGES = ["home", "about", "president", "cabinet", "events", "gallery", "alumni", "contact"];
  const pageTitle = {
    home: "The Debating Club", about: "About Us", president: "President",
    cabinet: "Our Cabinet", events: "Events", gallery: "Gallery",
    alumni: "Alumni", contact: "Contact"
  };
  function showPage() {
    const requested = window.location.hash.slice(1).toLowerCase();
    const id = PAGES.includes(requested) ? requested : "home";
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${id}`));
    document.querySelectorAll(".nav-links a").forEach(link => {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    document.title = `${pageTitle[id]} | The Debating Club | University of Agriculture Faisalabad`;
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  window.addEventListener("hashchange", showPage);
  window.addEventListener("DOMContentLoaded", showPage, { once: true });
  showPage();

  const form = document.getElementById("contactForm");
  if (form) {
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.className = "form-status";
    form.appendChild(status);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const name = form.elements.namedItem("name").value.trim();
      const email = form.elements.namedItem("email").value.trim();
      const subject = form.elements.namedItem("subject").value.trim();
      const message = form.elements.namedItem("message").value.trim();
      if (![name, email, subject, message].every(Boolean)) {
        status.textContent = "Please complete every field.";
        return;
      }
      const text = `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage: ${message}`;
      const url = `https://wa.me/923276985137?text=${encodeURIComponent(text)}`;
      // Do not request the "noopener" window feature here: browsers return null
      // for that feature even when the new tab opens successfully.
      const opened = window.open(url, "_blank");
      if (!opened) {
        status.textContent = "Your browser blocked the WhatsApp window. Use the WhatsApp contact button or allow pop-ups.";
        return;
      }
      opened.opener = null;
      status.textContent = "WhatsApp opened with your message. Review it and press Send in WhatsApp.";
      form.reset();
    });
  }
})();
