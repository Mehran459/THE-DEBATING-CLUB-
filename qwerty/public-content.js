/* Public Firestore content integration. Static HTML remains as a fallback. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./admin/firebase-config.js";

const app = initializeApp(firebaseConfig, "public-site");
const db = getFirestore(app);
const safeUrl = value => {
  try { const u = new URL(String(value)); return ["https:"].includes(u.protocol) ? u.href : ""; }
  catch { return ""; }
};
const node = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
};
async function readPublished(name, max = 30) {
  const snapshot = await getDocs(query(collection(db, name), where("published", "==", true), limit(max)));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function readCabinet(max = 60) {
  const snapshot = await getDocs(query(collection(db, "cabinet"), where("status", "in", ["Current", "Alumni"]), limit(max)));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
function renderAnnouncements(items) {
  const host = document.getElementById("public-announcements");
  if (!host || !items.length) return;
  host.replaceChildren();
  items.forEach(item => {
    const card = node("article", "event-card");
    card.append(node("div", "event-icon", "📢"), node("h3", "", item.title || "Announcement"), node("p", "", item.body || ""));
    host.append(card);
  });
}
function renderEvents(items) {
  const host = document.querySelector("#page-events .events-container:not(#public-announcements)");
  if (!host || !items.length) return;
  host.replaceChildren();
  items.forEach(item => {
    const card = node("article", "event-card");
    card.append(node("div", "event-icon", "🎤"), node("h3", "", item.title || "Club event"));
    if (item.date) card.append(node("p", "", `Date: ${item.date}`));
    if (item.venue) card.append(node("p", "", `Venue: ${item.venue}`));
    if (item.body) card.append(node("p", "", item.body));
    host.append(card);
  });
}
function renderGallery(items) {
  const host = document.querySelector("#page-gallery .gallery-container");
  if (!host || !items.length) return;
  const validItems = items.filter(item => safeUrl(item.url));
  if (!validItems.length) return;
  host.replaceChildren();
  validItems.forEach(item => {
    const card = node("div", "gallery-item");
    const url = safeUrl(item.url);
    if (item.type === "Video link") {
      const link = node("a", "gallery-video-link", item.title || "Watch club video");
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      card.append(link);
    } else {
      const img = document.createElement("img");
      img.src = url; img.alt = item.title || "The Debating Club event"; img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("error", () => { card.replaceChildren(node("p", "", "Image unavailable")); }, { once: true });
      card.append(img);
    }
    if (item.title) card.append(node("p", "gallery-caption", item.title));
    host.append(card);
  });
}
function renderCabinet(items) {
  const host = document.querySelector("#page-cabinet .cabinet-container");
  if (!host || !items.length) return;
  host.replaceChildren();
  items.forEach(item => {
    const card = node("article", "cabinet-card");
    const url = safeUrl(item.photoURL);
    if (url) {
      const img = document.createElement("img"); img.src = url; img.alt = item.name ? `${item.name} portrait` : "Cabinet member";
      img.loading = "lazy"; img.decoding = "async";
      img.addEventListener("error", () => img.remove(), { once: true }); card.append(img);
    }
    card.append(node("h3", "", item.name || "Club member"), node("p", "", item.role || "Member"));
    host.append(card);
  });
}
async function initPublicContent() {
  const tasks = [
    ["announcements", () => readPublished("announcements"), renderAnnouncements],
    ["events", () => readPublished("events"), renderEvents],
    ["gallery", () => readPublished("gallery"), renderGallery],
    ["cabinet", readCabinet, renderCabinet]
  ];
  // Load each section independently so a permissions/configuration issue in one
  // collection never prevents other live sections from appearing.
  await Promise.all(tasks.map(async ([name, load, render]) => {
    try {
      const items = await load();
      render(items);
    } catch (error) {
      // Keep bundled HTML content visible for the section that failed.
      console.warn(`Live ${name} could not be loaded; showing bundled content instead.`, error);
    }
  }));
}
initPublicContent();
