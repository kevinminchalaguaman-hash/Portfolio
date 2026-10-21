// 1. Fade sections in when they scroll into view
const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.15 }
);

revealItems.forEach((item) => observer.observe(item));

// 2 and 3. Progress bar and moving glow
const progress = document.getElementById("progress");
const glow = document.querySelector(".glow");

window.addEventListener("scroll", () => {
  const scrolled = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

  progress.style.width = (scrolled / maxScroll) * 100 + "%";
  glow.style.transform = "translateY(" + scrolled * 0.4 + "px)";
});

// ---------- Contact form ----------
const contactForm = document.getElementById("contactForm");
const formStatus = document.getElementById("formStatus");

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    message: document.getElementById("message").value
  };

  formStatus.className = "";
  formStatus.textContent = "Sending...";

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (response.ok) {
      formStatus.textContent = "Thanks! Your message was sent.";
      formStatus.className = "success";
      contactForm.reset();
    } else {
      formStatus.textContent = data.error;
      formStatus.className = "error";
    }
  } catch (error) {
    formStatus.textContent = "Something went wrong. Please try again.";
    formStatus.className = "error";
  }
});