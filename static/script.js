// ---------- Mobile menu ----------
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.getElementById("nav-links");

function closeMenu() {
  navToggle.setAttribute("aria-expanded", "false");
  navLinks.classList.remove("open");
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navLinks.classList.toggle("open", !isOpen);
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

// ---------- Sections ease in as they scroll into view ----------
const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

// ---------- Scroll progress bar ----------
const progress = document.getElementById("progress");

function updateProgress() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  progress.style.transform = "scaleX(" + Math.min(1, Math.max(0, ratio)) + ")";
}

if (progress) {
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();
}

// ---------- Resume hover preview ----------
// Draws page 1 of static/resume.pdf with PDF.js the first time someone hovers.
// Replacing resume.pdf updates the preview automatically.
const resumeCard = document.querySelector(".resume-card");
const resumeCanvas = document.getElementById("resumeCanvas");
const resumeMessage = document.getElementById("resumePreviewMsg");
let resumeRequested = false;

async function renderResumePreview() {
  if (resumeRequested) return;
  resumeRequested = true;

  try {
    if (!window.pdfjsLib) throw new Error("PDF.js did not load");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const pdf = await pdfjsLib.getDocument(resumeCard.dataset.pdf).promise;
    const page = await pdf.getPage(1);

    const boxWidth = resumeCanvas.parentElement.clientWidth || 320;
    const pixelRatio = window.devicePixelRatio || 1;
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (boxWidth * pixelRatio) / baseViewport.width });

    resumeCanvas.width = viewport.width;
    resumeCanvas.height = viewport.height;
    await page.render({ canvasContext: resumeCanvas.getContext("2d"), viewport }).promise;
    resumeMessage.hidden = true;
  } catch (error) {
    console.warn("Resume preview failed:", error);
    resumeMessage.textContent = "Preview unavailable. Use the button to open the PDF.";
  }
}

if (resumeCard && resumeCanvas && window.matchMedia("(hover: hover)").matches) {
  resumeCard.addEventListener("mouseenter", renderResumePreview);
  resumeCard.addEventListener("focusin", renderResumePreview);
}

// ---------- Contact form ----------
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = contactForm.querySelector('button[type="submit"]');
    const payload = {
      name: document.getElementById("name").value,
      email: document.getElementById("email").value,
      message: document.getElementById("message").value,
      website: document.getElementById("website").value,
    };

    formStatus.className = "form-status";
    formStatus.textContent = "Sending…";
    submitButton.disabled = true;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        formStatus.textContent = "Message sent. I'll get back to you soon.";
        formStatus.classList.add("success");
        contactForm.reset();
      } else {
        formStatus.textContent = data.error || "The message didn't send. Try again in a minute.";
        formStatus.classList.add("error");
      }
    } catch (error) {
      formStatus.textContent = "The message didn't send. Check your connection and try again.";
      formStatus.classList.add("error");
    } finally {
      submitButton.disabled = false;
    }
  });
}
