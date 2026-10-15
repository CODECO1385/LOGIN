/* =====================================================
   FORMSPREE CONFIG — paste/replace your endpoint here.
   Destination email (alansgl@outlook.com) is configured
   in your Formspree dashboard, not here.
   Note: file attachments require a Formspree plan that
   supports file uploads. If yours doesn't, the request
   will fail and the error message will be shown.
   ===================================================== */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xaeqlela";

/* Image rules */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Shared helpers ---------- */
function setError(id, msg) {
  const p = $(`[data-error-for="${id}"]`);
  if (p) p.textContent = msg || "";
  const el = document.getElementById(id);
  if (el) el.classList.toggle("invalid", !!msg);
  else if (id === "campaign_image") $("#dropzone").classList.toggle("invalid", !!msg);
}
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/* ---------- Navigation between views ---------- */
function showView(id) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === id));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === id));
  window.scrollTo({ top: 0 });
}
$$(".nav-btn").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));

/* ---------- LOGIN ---------- */
/* Placeholder: connect to Supabase Authentication later.
   Must return a real session from the service; nothing is faked here. */
async function authenticateUser(email, password) {
  // TODO (Supabase): const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  throw new Error("AUTH_NOT_CONFIGURED");
}

$("#login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("#login-email").value.trim();
  const pass = $("#login-password").value;
  const notice = $("#login-notice");
  notice.className = "notice"; notice.textContent = "";
  let ok = true;
  setError("login-email", !email ? "Enter your email." : !isEmail(email) ? "Enter a valid email address." : "");
  setError("login-password", !pass ? "Enter your password." : "");
  if (!email || !isEmail(email) || !pass) ok = false;
  if (!ok) return;
  try {
    await authenticateUser(email, pass);
  } catch (err) {
    notice.classList.add("err");
    notice.textContent = err.message === "AUTH_NOT_CONFIGURED"
      ? "Authentication will be available once the service is configured."
      : "Could not sign in. Please try again.";
  }
  $("#login-password").value = ""; // never keep the password around
});
$("#forgot-link").addEventListener("click", e => {
  e.preventDefault();
  const n = $("#login-notice");
  n.className = "notice";
  n.textContent = "Password recovery will be available once authentication is configured.";
});

/* ---------- CAMPAIGN FORM: conditional fields ---------- */
const form = $("#campaign-form");

function toggleGroup(wrapId, show) {
  const wrap = document.getElementById(wrapId);
  wrap.hidden = !show;
  // Disabled fields are excluded from FormData, so hidden answers are never sent
  $$("input,select", wrap).forEach(i => { i.disabled = !show; if (!show) { i.value = i.tagName === "SELECT" ? i.options[0].value : ""; } });
  if (!show) $$(".error", wrap).forEach(p => p.textContent = "");
}
$("#product_category").addEventListener("change", e => toggleGroup("category-other-wrap", e.target.value === "Other"));
$$('input[name="promotion_type"]').forEach(r => r.addEventListener("change", () => {
  setError("promotion_type", "");
  toggleGroup("fixed-wrap", r.value === "Fixed Discount" && r.checked);
  toggleGroup("free-wrap", r.value === "Free Product" && r.checked);
  toggleGroup("custom-wrap", r.value === "Custom Promotion" && r.checked);
}));

/* Dates: end date cannot be earlier than start date */
$("#start_date").addEventListener("change", e => { $("#end_date").min = e.target.value; });

/* Character counter */
$("#promotion_details").addEventListener("input", e => { $("#details-count").textContent = e.target.value.length; });

/* ---------- Image upload & preview ---------- */
const fileInput = $("#campaign_image");
let previewURL = null;

function clearImage() {
  fileInput.value = "";
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = null;
  $("#preview-box").hidden = true;
  $("#dropzone").hidden = false;
}
function validateImage() {
  const f = fileInput.files[0];
  if (!f) return "";
  if (!ALLOWED_TYPES.includes(f.type)) return "Invalid format. Use a JPG, PNG or WEBP image.";
  if (f.size > MAX_IMAGE_BYTES) return "Image is too large. Maximum size is 5 MB.";
  return "";
}
fileInput.addEventListener("change", () => {
  const f = fileInput.files[0];
  if (!f) return;
  const msg = validateImage();
  setError("campaign_image", msg);
  if (msg) { clearImage(); setError("campaign_image", msg); return; }
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewURL = URL.createObjectURL(f);
  $("#preview-img").src = previewURL;
  $("#preview-box").hidden = false;
  $("#dropzone").hidden = true;
});
$("#remove-image").addEventListener("click", () => { clearImage(); setError("campaign_image", ""); });

/* ---------- Validation ---------- */
function validateCampaign() {
  const v = id => (document.getElementById(id).value || "").trim();
  const errs = {};
  const req = (id, msg) => { if (!v(id)) errs[id] = msg; };

  req("product_name", "Enter the product name.");
  req("product_category", "Select a category.");
  if (v("product_category") === "Other") req("product_category_custom", "Enter your category.");

  req("start_date", "Select a start date.");
  req("end_date", "Select an end date.");
  if (v("start_date") && v("end_date") && v("end_date") < v("start_date"))
    errs.end_date = "End date cannot be before the start date.";

  const type = $('input[name="promotion_type"]:checked');
  if (!type) errs.promotion_type = "Select a promotion type.";
  else if (type.value === "Fixed Discount") { if (!(parseFloat(v("discount_amount")) > 0)) errs.discount_amount = "Enter a discount amount greater than 0."; }
  else if (type.value === "Free Product") req("free_product", "Enter the free product.");
  else if (type.value === "Custom Promotion") req("custom_promotion", "Describe your promotion.");

  req("promotion_details", "Enter the promotion details.");
  req("headline", "Enter a headline.");
  req("slogan", "Enter a slogan.");

  const imgMsg = validateImage();
  if (imgMsg) errs.campaign_image = imgMsg;

  req("business_name", "Enter the business name.");
  req("owner_name", "Enter the owner's name.");
  if (!v("contact_email")) errs.contact_email = "Enter a contact email.";
  else if (!isEmail(v("contact_email"))) errs.contact_email = "Enter a valid email address.";
  req("business_type", "Select a business type.");
  if (!$("#confirmation").checked) errs.confirmation = "You must confirm before submitting.";

  // Clear old errors, then show the new ones
  $$("[data-error-for]").forEach(p => setError(p.dataset.errorFor, ""));
  Object.entries(errs).forEach(([id, m]) => setError(id, m));
  const first = Object.keys(errs)[0];
  if (first) (document.getElementById(first) || $("#dropzone")).scrollIntoView({ behavior: "smooth", block: "center" });
  return !first;
}

/* ---------- Submit to Formspree ---------- */
let submitting = false;
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (submitting) return;
  const notice = $("#form-notice");
  notice.className = "notice"; notice.textContent = "";

  if (!validateCampaign()) return;

  if (!FORMSPREE_ENDPOINT) {
    notice.classList.add("err");
    notice.textContent = "The submission service is not configured yet. Your data has been kept.";
    return; // nothing is sent; form data stays in place
  }

  const data = new FormData(form);              // includes campaign_image if selected
  if (!fileInput.files[0]) data.delete("campaign_image");

  const btn = $("#submit-btn");
  submitting = true; btn.disabled = true; btn.classList.add("loading");
  notice.textContent = "Submitting your campaign…";

  try {
    // No Content-Type header: the browser sets the multipart boundary itself
    const res = await fetch(FORMSPREE_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } });
    if (res.ok) {
      form.hidden = true;
      $("#campaign-success").hidden = false;
      notice.textContent = "";
      window.scrollTo({ top: 0 });
    } else {
      let msg = "The campaign could not be submitted. Please try again.";
      try { const j = await res.json(); if (j.errors?.length) msg = j.errors.map(x => x.message).join(" "); } catch (_) {}
      throw new Error(msg);
    }
  } catch (err) {
    notice.className = "notice err";
    notice.textContent = err instanceof TypeError ? "Network error. Check your connection and try again." : err.message;
  } finally {
    submitting = false; btn.disabled = false; btn.classList.remove("loading");
  }
});

/* Reset after a successful submission */
$("#new-campaign").addEventListener("click", () => {
  form.reset(); clearImage();
  ["category-other-wrap", "fixed-wrap", "free-wrap", "custom-wrap"].forEach(id => toggleGroup(id, false));
  $("#details-count").textContent = "0";
  $("#end_date").removeAttribute("min");
  $("#campaign-success").hidden = true; form.hidden = false;
});
