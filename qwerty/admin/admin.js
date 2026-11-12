/* ==========================================================
   THE DEBATING CLUB UAF — FIREBASE ADMIN DASHBOARD
   Developed by Mehran Shoukat
   Firebase Auth + Cloud Firestore + Firebase Storage
   ========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id) => document.getElementById(id);
const ROLE_LABELS = { main: "Main Admin", president: "President", gs: "General Secretary" };
const NAV = ["dashboard", "announcements", "events", "gallery", "cabinet", "accounts", "log"];
const SECTIONS = {
  dashboard: { title: "Dashboard", icon: "▦" },
  announcements: {
    title: "Announcements", icon: "◈", collection: "announcements", single: "Announcement",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "body", label: "Message", type: "textarea", required: true },
      { key: "published", label: "Visibility", type: "select", options: [["true","Published"],["false","Draft"]], required: true }
    ]
  },
  events: {
    title: "Events", icon: "▣", collection: "events", single: "Event",
    fields: [
      { key: "title", label: "Event name", type: "text", required: true },
      { key: "date", label: "Event date", type: "date", required: true },
      { key: "venue", label: "Venue", type: "text" },
      { key: "body", label: "Details", type: "textarea" },
      { key: "published", label: "Visibility", type: "select", options: [["true","Published"],["false","Draft"]], required: true }
    ]
  },
  gallery: {
    title: "Gallery", icon: "▧", collection: "gallery", single: "Gallery item",
    fields: [
      { key: "title", label: "Caption", type: "text", required: true },
      { key: "type", label: "Media type", type: "select", options: [["Photo","Photo"],["Video link","Video link"]], required: true },
      { key: "url", label: "Media URL (or upload a file)", type: "url" },
      { key: "mediaFile", label: "Upload image (optional; max 14 MiB)", type: "file", accept: ".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif" },
      { key: "published", label: "Visibility", type: "select", options: [["true","Published"],["false","Draft"]], required: true }
    ]
  },
  cabinet: {
    title: "Cabinet Members", icon: "♙", collection: "cabinet", single: "Member",
    fields: [
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "role", label: "Position", type: "text", required: true },
      { key: "status", label: "Status", type: "select", options: [["Current","Current"],["Alumni","Alumni"]], required: true },
      { key: "photoURL", label: "Photo URL (optional)", type: "url" },
      { key: "photoFile", label: "Upload portrait (optional; max 14 MiB)", type: "file", accept: ".jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif" }
    ]
  },
  accounts: {
    title: "Admin Accounts", icon: "♧", collection: "admins", single: "Admin profile",
    fields: [
      { key: "uid", label: "Firebase Auth UID (create user in Firebase first)", type: "text", required: true },
      { key: "name", label: "Full name", type: "text", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "role", label: "Role", type: "select", options: [["president","President"],["gs","General Secretary"]], required: true },
      { key: "active", label: "Account access", type: "select", options: [["true","Active"],["false","Disabled"]], required: true }
    ]
  }
};
let currentUser = null;
let adminProfile = null;
let currentSection = "dashboard";
let records = {};
let editingId = null;
let toastTimer = null;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
}
function showToast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").hidden = true, 2800);
}
function showLoginError(message = "") { $("loginError").textContent = message; }
function isMain() { return adminProfile?.role === "main"; }
function canView(section) {
  if (!adminProfile) return false;
  if (isMain()) return true;
  return ["dashboard", "announcements", "events", "gallery", "cabinet"].includes(section);
}
function canAdd(section) {
  if (isMain()) return ["announcements","events","gallery","cabinet","accounts"].includes(section);
  return ["announcements","events","gallery"].includes(section);
}
function canEdit(section, item) {
  // Keep the signed-in Main Admin profile read-only in this form. The rules
  // intentionally prohibit changing its role/access, and the role selector is
  // reserved for non-privileged dashboard accounts.
  if (section === "accounts" && (item.id === currentUser?.uid || item.role === "main")) return false;
  if (isMain()) return true;
  return ["announcements","events","gallery"].includes(section) && item.createdBy === currentUser.uid;
}
function dateText(value) {
  if (!value) return "—";
  let d;
  if (value?.toDate) d = value.toDate();
  else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    d = new Date(year, month - 1, day);
  } else d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
}
function timestampText(value) {
  if (!value) return "Just now";
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function roleName(role) { return ROLE_LABELS[role] || role || "Admin"; }
function setBusy(button, busy, label = "Saving…") {
  if (!button) return;
  if (busy) { button.dataset.original = button.textContent; button.disabled = true; button.textContent = label; }
  else { button.disabled = false; button.textContent = button.dataset.original || "Save changes"; }
}

async function loadProfile(user) {
  const snap = await getDoc(doc(db, "admins", user.uid));
  if (!snap.exists()) throw new Error("Your Firebase account has no admin profile. Ask the Main Admin to add your UID.");
  const profile = snap.data();
  if (profile.active !== true) throw new Error("This admin account is disabled. Contact the Main Admin.");
  return { ...profile, uid: user.uid };
}
async function signIn(email, password) {
  showLoginError("");
  const button = $("loginForm").querySelector("button[type=submit]");
  setBusy(button, true, "Signing in…");
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showLoginError(authMessage(error));
  } finally {
    setBusy(button, false);
  }
}
function authMessage(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "Email or password is incorrect.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please try again later.";
  if (code.includes("network")) return "Network error. Check your internet connection.";
  return error?.message || "Unable to sign in.";
}

$("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  signIn($("loginEmail").value.trim(), $("loginPassword").value);
});
$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  showToast("You have been signed out.");
});
$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("sideNav").addEventListener("click", e => {
  const button = e.target.closest("[data-go]");
  if (!button) return;
  $("sidebar").classList.remove("open");
  navigate(button.dataset.go);
});
$("content").addEventListener("click", e => {
  const add = e.target.closest("#addBtn");
  const edit = e.target.closest("[data-edit]");
  const remove = e.target.closest("[data-delete]");
  if (add) openEditor(currentSection);
  if (edit) openEditor(currentSection, edit.dataset.edit);
  if (remove) deleteRecord(currentSection, remove.dataset.delete);
});
$("modalClose").addEventListener("click", closeEditor);
$("modalCancel").addEventListener("click", closeEditor);
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closeEditor(); });
$("modalForm").addEventListener("submit", saveRecord);

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) { adminProfile = null; $("appView").hidden = true; $("loginView").hidden = false; return; }
  try {
    adminProfile = await loadProfile(user);
    $("loginView").hidden = true;
    $("appView").hidden = false;
    $("userName").textContent = adminProfile.name || user.email;
    $("userRole").textContent = roleName(adminProfile.role);
    $("userAvatar").textContent = (adminProfile.name || user.email || "A").charAt(0).toUpperCase();
    buildNavigation();
    await navigate("dashboard");
    await writeActivity("Signed in");
  } catch (error) {
    await signOut(auth);
    showLoginError(error.message);
    $("loginView").hidden = false;
    $("appView").hidden = true;
  }
});

function buildNavigation() {
  $("sideNav").innerHTML = NAV.filter(canView).map(key =>
    `<button type="button" data-go="${key}"><span class="nav-icon">${SECTIONS[key].icon}</span>${SECTIONS[key].title}</button>`
  ).join("");
}
async function navigate(section) {
  if (!canView(section) || !SECTIONS[section]) return;
  currentSection = section;
  $("pageTitle").textContent = SECTIONS[section].title;
  $("sideNav").querySelectorAll("[data-go]").forEach(b => b.classList.toggle("active", b.dataset.go === section));
  if (section === "dashboard") await renderDashboard();
  else if (section === "log") await renderActivity();
  else await renderTable(section);
  window.scrollTo({top:0,behavior:"smooth"});
}
async function fetchCollection(name, max = 150) {
  // Avoid orderBy(createdAt): older/manual cabinet documents may not have that field.
  const snap = await getDocs(query(collection(db, name), limit(max)));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const millis = value => value?.toDate ? value.toDate().getTime() : (value ? new Date(value).getTime() : 0);
  return rows.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}
async function renderDashboard() {
  $("content").innerHTML = `<div class="loading-state">Loading live data…</div>`;
  try {
    const [announcements, events, gallery, cabinet, activity] = await Promise.all([
      fetchCollection("announcements"), fetchCollection("events"), fetchCollection("gallery"),
      fetchCollection("cabinet"), isMain() ? fetchCollection("activityLogs", 8) : Promise.resolve([])
    ]);
    const currentMembers = cabinet.filter(x => x.status === "Current").length;
    $("content").innerHTML = `
      <div class="welcome-panel"><div><p class="eyebrow">WELCOME BACK</p><h3>${escapeHTML(adminProfile.name || "Admin")}</h3><p>You are signed in as ${escapeHTML(roleName(adminProfile.role))}.</p></div><div class="welcome-symbol">DC</div></div>
      <div class="stats">
        ${statCard("Announcements",announcements.length,"◈")}${statCard("Events",events.length,"▣")}
        ${statCard("Gallery items",gallery.length,"▧")}${statCard("Current members",currentMembers,"♙")}
      </div>
      <div class="panel"><div class="panel-head"><div><h3>Quick actions</h3><p>Manage the club website content.</p></div></div>
        <div class="quick-grid">
          ${quickAction("announcements","Post announcement","Share an important update")}
          ${quickAction("events","Add an event","Publish an upcoming activity")}
          ${quickAction("gallery","Update gallery","Add a photo or video link")}
          ${quickAction("cabinet","Manage cabinet","Update club leadership")}
        </div>
      </div>
      ${isMain() ? `<div class="panel"><div class="panel-head"><div><h3>Recent activity</h3><p>Latest dashboard actions.</p></div></div><div class="panel-body">${activity.length ? activity.map(a=>`<div class="log-item"><strong>${escapeHTML(a.actorName || "Admin")}</strong> — ${escapeHTML(a.action || "")}<small>${timestampText(a.createdAt)}</small></div>`).join("") : `<div class="empty">No activity recorded yet.</div>`}</div></div>` : ""}
    `;
    $("content").querySelectorAll("[data-quick]").forEach(b => b.addEventListener("click", () => navigate(b.dataset.quick)));
  } catch (error) { showContentError(error); }
}
function statCard(label,value,icon) {
  return `<article class="stat"><span class="stat-icon">${icon}</span><span class="stat-label">${label}</span><strong>${value}</strong></article>`;
}
function quickAction(section,title,description) {
  return `<button class="quick-action" type="button" data-quick="${section}"><strong>${title}</strong><span>${description}</span><b>Open section →</b></button>`;
}
async function renderTable(section) {
  const config = SECTIONS[section];
  $("content").innerHTML = `<div class="loading-state">Loading ${escapeHTML(config.title.toLowerCase())}…</div>`;
  try {
    const data = await fetchCollection(config.collection);
    records[section] = data;
    const columns = tableColumns(section);
    const rows = data.map(item => `<tr>${columns.map(col=>`<td>${col.render(item)}</td>`).join("")}
      <td><div class="actions">${canEdit(section,item) ? `<button class="btn btn-light btn-sm" data-edit="${escapeHTML(item.id)}">Edit</button><button class="btn btn-danger btn-sm" data-delete="${escapeHTML(item.id)}">Delete</button>` : `<span class="muted small">View only</span>`}</div></td></tr>`).join("");
    const note = !isMain() ? `<div class="notice">You can manage only the announcements, events and gallery items you created. Cabinet is view-only.</div>` : "";
    $("content").innerHTML = `${note}<div class="panel"><div class="panel-head"><div><h3>${config.title}</h3><p>${data.length} record(s) · Live Firebase data</p></div>${canAdd(section) ? `<button id="addBtn" class="btn btn-primary" type="button">+ Add ${config.single}</button>` : ""}</div>
      <div class="table-wrap">${data.length ? `<table><thead><tr>${columns.map(c=>`<th>${c.label}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty"><span>Nothing here yet</span><small>Add your first ${config.single.toLowerCase()} to get started.</small></div>`}</div></div>`;
  } catch (error) { showContentError(error); }
}
function tableColumns(section) {
  const text = (v) => escapeHTML(v || "—");
  if (section === "announcements") return [
    {label:"Announcement",render:x=>`<strong>${text(x.title)}</strong><small>${text((x.body||"").slice(0,90))}</small>`},
    {label:"Status",render:x=>statusBadge(x.published)},
    {label:"Posted",render:x=>dateText(x.createdAt)}
  ];
  if (section === "events") return [
    {label:"Event",render:x=>`<strong>${text(x.title)}</strong><small>${text(x.venue)}</small>`},
    {label:"Date",render:x=>dateText(x.date)},
    {label:"Status",render:x=>statusBadge(x.published)}
  ];
  if (section === "gallery") return [
    {label:"Preview",render:x=>x.type==="Photo" ? (validHttpsUrl(x.url || "") ? `<img class="thumb" src="${text(x.url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : "—") : `<span class="badge grey">Video</span>`},
    {label:"Caption",render:x=>text(x.title)},
    {label:"Status",render:x=>statusBadge(x.published)}
  ];
  if (section === "cabinet") return [
    {label:"Member",render:x=>`<strong>${text(x.name)}</strong>`},
    {label:"Position",render:x=>text(x.role)},
    {label:"Status",render:x=>statusBadge(x.status==="Current")}
  ];
  return [
    {label:"Admin",render:x=>`<strong>${text(x.name)}</strong><small>${text(x.email)}</small>`},
    {label:"Role",render:x=>`<span class="badge">${text(roleName(x.role))}</span>`},
    {label:"Access",render:x=>statusBadge(x.active)}
  ];
}
function statusBadge(value) {
  const active = value === true || value === "Current";
  const label = value === true ? "Published" : value === false ? "Draft" : value || "Unknown";
  return `<span class="badge ${active ? "green" : "grey"}">${escapeHTML(label)}</span>`;
}
async function renderActivity() {
  $("content").innerHTML = `<div class="loading-state">Loading activity…</div>`;
  try {
    const data = await fetchCollection("activityLogs", 100);
    $("content").innerHTML = `<div class="panel"><div class="panel-head"><div><h3>Activity Log</h3><p>Recent admin actions.</p></div><span class="badge">Main Admin only</span></div><div class="panel-body">${data.length ? data.map(x=>`<div class="log-item"><strong>${escapeHTML(x.actorName||"Admin")}</strong> — ${escapeHTML(x.action||"")}<small>${timestampText(x.createdAt)}</small></div>`).join("") : `<div class="empty">No activity recorded yet.</div>`}</div></div>`;
  } catch (error) { showContentError(error); }
}
function showContentError(error) {
  console.error(error);
  $("content").innerHTML = `<div class="error-panel"><strong>Unable to load this section</strong><p>${escapeHTML(error.message || "Please check your Firebase configuration and security rules.")}</p><button class="btn btn-light" id="retryBtn" type="button">Try again</button></div>`;
  $("retryBtn").addEventListener("click", () => navigate(currentSection));
}
function openEditor(section, id = null) {
  if (!canAdd(section)) return;
  const config = SECTIONS[section];
  const item = id ? (records[section] || []).find(x=>x.id===id) : null;
  if (id && (!item || !canEdit(section,item))) return showToast("You do not have permission to edit this record.");
  editingId = id;
  $("modalTitle").textContent = `${item ? "Edit" : "Add"} ${config.single}`;
  $("modalError").textContent = "";
  $("modalFields").innerHTML = config.fields.map(field => {
    // Account UID is the Firestore document ID; edit mode keeps it locked.
    const value = field.key === "uid" ? (item?.id || "") : (item?.[field.key] ?? "");
    const required = field.required ? "required" : "";
    if (field.type === "textarea") return `<label>${field.label}<textarea name="${field.key}" ${required}>${escapeHTML(value)}</textarea></label>`;
    if (field.type === "file") return `<label>${field.label}<input name="${field.key}" type="file" accept="${escapeHTML(field.accept || "")}"></label>`;
    if (field.type === "select") return `<label>${field.label}<select name="${field.key}" ${required}>${field.options.map(([v,l])=>`<option value="${v}" ${String(value)===v?"selected":""}>${l}</option>`).join("")}</select></label>`;
    const disabled = field.key === "uid" && item ? "disabled" : "";
    return `<label>${field.label}<input name="${field.key}" type="${field.type}" value="${escapeHTML(value)}" ${required} ${disabled}></label>`;
  }).join("");
  $("modal").hidden = false;
}
function closeEditor() { $("modal").hidden = true; editingId = null; }
async function saveRecord(event) {
  event.preventDefault();
  const section = currentSection;
  const config = SECTIONS[section];
  const button = $("modalSave");
  setBusy(button,true);
  $("modalError").textContent = "";
  let uploadedStoragePath = "";
  let oldStoragePathForCleanup = "";
  let recordSaved = false;
  try {
    const form = new FormData($("modalForm"));
    const payload = {};
    config.fields.forEach(field => {
      if ((field.key === "uid" && editingId) || field.type === "file") return;
      let value = String(form.get(field.key) ?? "").trim();
      if (field.type === "select" && ["true","false"].includes(value)) value = value === "true";
      if (value !== "" || field.required) payload[field.key] = value;
    });
    const mediaFile = form.get("mediaFile");
    const photoFile = form.get("photoFile");
    if (section === "gallery") {
      if (!["Photo", "Video link"].includes(payload.type)) throw new Error("Choose a valid media type.");
      if (payload.url && !validHttpsUrl(payload.url)) throw new Error("Enter a valid secure https:// media URL.");
      if (mediaFile && mediaFile.size && payload.type !== "Photo") throw new Error("Upload a file only for Photo items. Use a video URL for video links.");
      if ((!payload.url || !validHttpsUrl(payload.url)) && !(mediaFile && mediaFile.size)) throw new Error("Provide a valid https:// media URL or upload an image.");
    }
    if (section === "cabinet" && payload.photoURL && !validHttpsUrl(payload.photoURL)) throw new Error("Enter a valid secure https:// photo URL.");
    const selectedFile = section === "gallery" ? mediaFile : section === "cabinet" ? photoFile : null;
    if (selectedFile && selectedFile.size) {
      if (selectedFile.size >= 14 * 1024 * 1024) throw new Error("Files must be smaller than 14 MiB.");
      const allowedTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
      if (!allowedTypes.has(selectedFile.type)) throw new Error("Use a JPG, PNG, GIF, WebP or AVIF image.");
      oldStoragePathForCleanup = editingId ? ((records[section] || []).find(x => x.id === editingId)?.storagePath || "") : "";
      const uploaded = await uploadClubMedia(selectedFile, section);
      uploadedStoragePath = uploaded.path;
      if (section === "gallery") payload.url = uploaded.url;
      else payload.photoURL = uploaded.url;
      payload.storagePath = uploaded.path;
    }
    if (section === "accounts") {
      if (!isMain()) throw new Error("Only the Main Admin can manage admin profiles.");
      if (!editingId && !["president", "gs"].includes(payload.role)) throw new Error("New dashboard accounts must be President or General Secretary. Bootstrap Main Admin accounts in Firebase Console.");
      const uid = payload.uid;
      delete payload.uid;
      if (editingId) {
        delete payload.email; // Email is managed by Firebase Authentication.
        delete payload.uid;
        await updateDoc(doc(db,"admins",editingId),{...payload,updatedAt:serverTimestamp()});
      } else {
        if (!uid) throw new Error("Firebase Auth UID is required.");
        if (uid.length > 128 || uid.includes("/") || /[\u0000-\u001F\u007F]/.test(uid)) throw new Error("Enter a valid Firebase Authentication UID (maximum 128 characters).");
        if (payload.role === "main") throw new Error("Create additional Main Admin profiles manually in Firebase Console.");
        await setDoc(doc(db,"admins",uid),{...payload,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      }
    } else if (editingId) {
      await updateDoc(doc(db,config.collection,editingId),{...payload,updatedAt:serverTimestamp()});
      await writeActivity(`Updated ${config.single.toLowerCase()}: ${payload.title || payload.name || editingId}`);
    } else {
      await addDoc(collection(db,config.collection),{
        ...payload, createdBy:currentUser.uid, createdByName:adminProfile.name || currentUser.email,
        createdAt:serverTimestamp(), updatedAt:serverTimestamp()
      });
      await writeActivity(`Added ${config.single.toLowerCase()}: ${payload.title || payload.name || "New record"}`);
    }
    recordSaved = true;
    if (oldStoragePathForCleanup && oldStoragePathForCleanup !== uploadedStoragePath) {
      try { await deleteObject(storageRef(storage, oldStoragePathForCleanup)); }
      catch (cleanupError) { console.warn("Old media cleanup failed:", cleanupError); }
    }
    closeEditor();
    showToast("Changes saved to Firebase.");
    await navigate(section);
  } catch (error) {
    if (uploadedStoragePath && !recordSaved) {
      try { await deleteObject(storageRef(storage, uploadedStoragePath)); }
      catch (cleanupError) { console.warn("Failed upload cleanup:", cleanupError); }
    }
    $("modalError").textContent = error.message || "Could not save this record.";
  } finally { setBusy(button,false); }
}
async function uploadClubMedia(file, section) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "upload";
  const path = `club-media/${currentUser.uid}/${Date.now()}-${safeName}`;
  const reference = storageRef(storage, path);
  await uploadBytes(reference, file, { contentType: file.type });
  return { path, url: await getDownloadURL(reference) };
}
function validHttpsUrl(value) {
  try { const url = new URL(value); return url.protocol === "https:"; }
  catch { return false; }
}
async function deleteRecord(section,id) {
  const item = (records[section]||[]).find(x=>x.id===id);
  if (!item || !canEdit(section,item)) return showToast("You do not have permission to delete this record.");
  if (section === "accounts" && (id === currentUser.uid || item.role === "main")) return showToast("Main Admin profiles cannot be changed or deleted from this dashboard.");
  if (!confirm(`Delete this ${SECTIONS[section].single.toLowerCase()} permanently?`)) return;
  try {
    if (section === "accounts") await deleteDoc(doc(db,"admins",id));
    else {
      await deleteDoc(doc(db,SECTIONS[section].collection,id));
      if (item.storagePath) {
        try { await deleteObject(storageRef(storage, item.storagePath)); }
        catch (cleanupError) { console.warn("Media cleanup failed after record deletion:", cleanupError); }
      }
      await writeActivity(`Deleted ${SECTIONS[section].single.toLowerCase()}: ${item.title || item.name || id}`);
    }
    showToast("Record deleted.");
    await navigate(section);
  } catch (error) { showToast(error.message || "Delete failed."); }
}
async function writeActivity(action) {
  try {
    await addDoc(collection(db,"activityLogs"),{
      actorUid:currentUser.uid, actorName:adminProfile?.name || currentUser.email,
      action, createdAt:serverTimestamp()
    });
  } catch (error) {
    // A non-main role may not have permission to write logs under a stricter custom policy.
    console.warn("Activity log was not written:",error);
  }
}
function escapeConfigWarning() {
  const placeholders = Object.values(firebaseConfig).some(v=>String(v).includes("YOUR_"));
  if (placeholders) showLoginError("First add your Firebase Web App configuration in firebase-config.js.");
}
escapeConfigWarning();
