// Global variables to manage slideshow state.
let currentIndex = 0;
let slideInterval = null;
let paused = false;
let projectsList = [];
let slideDelay = 2000; // default to 2 seconds (2000ms)
let zooming = false; // flag for zoom animation

// Fetch multiple random comments for a given projectId and return an array of comment objects.
async function fetchRandomComments(projectId, count = 10) {
  try {
    // Fetch up to 100 comments for the project.
    const response = await fetch(
      `/api/v1/projects/${projectId}/comments?first=100&sort_order=desc`
    );
    const data = await response.json();
    const commentsData = data.comments?.data || [];
    if (commentsData.length === 0) {
      // Return an array with a single placeholder comment.
      return [
        {
          text: "No comments available.",
          author: null,
        },
      ];
    }
    // Shuffle the array to get random order.
    for (let i = commentsData.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [commentsData[i], commentsData[j]] = [commentsData[j], commentsData[i]];
    }
    // Map to the comment object structure.
    const mappedComments = commentsData.map((item) => {
      const selectedComment = item.comment;
      return {
        text: selectedComment.raw_content || "Comment content unavailable.",
        author: selectedComment.author,
      };
    });
    // Return up to 'count' comments.
    return mappedComments.slice(0, count);
  } catch (error) {
    console.error("Error fetching comments for project", projectId, error);
    return [
      {
        text: "Error loading comment.",
        author: null,
      },
    ];
  }
}

// The init function fetches projects for the current creator and starts the slideshow.
async function init() {
  try {
    // Get the current user who created this page.
    const createdBy = await window.websim.getCreatedBy();
    const username = createdBy.username;

    // Fetch the user's projects, sorted by most recent creation.
    const response = await fetch(
      `/api/v1/users/${username}/projects?sort_by=created_at&sort_order=desc&first=100`
    );
    const data = await response.json();

    // Filter projects that have a screenshot available in their current revision.
    const projects = data.projects.data
      .filter(
        (item) =>
          item.project_revision && item.project_revision.current_screenshot_url
      )
      .map((item) => {
        return {
          id: item.project.id,
          title: item.project.title || "Untitled Project",
          description: item.project.description || "",
          image: item.project_revision.current_screenshot_url,
          randomComments: [], // Placeholder for an array of random comment objects.
        };
      });

    if (projects.length === 0) {
      console.error("No project images available to display.");
      return;
    }

    // Pre-fetch up to 10 random comments for each project concurrently.
    await Promise.all(
      projects.map(async (project) => {
        project.randomComments = await fetchRandomComments(project.id, 10);
      })
    );

    // Start the slideshow with the fetched projects.
    startSlideshow(projects);

    // Attach event listeners for control buttons.
    document.getElementById("pause-btn").addEventListener("click", () => {
      if (paused) {
        paused = false;
        document.getElementById("pause-btn").textContent = "Pause";
      } else {
        paused = true;
        document.getElementById("pause-btn").textContent = "Play";
      }
    });
    document.getElementById("back-btn").addEventListener("click", () => {
      prevSlide();
    });
    document.getElementById("next-btn").addEventListener("click", () => {
      nextSlide();
    });
    // Attach event listener for slideshow speed slider.
    document.getElementById("speed-slider").addEventListener("input", (e) => {
      const newDelay = parseFloat(e.target.value) * 1000; // convert seconds to milliseconds
      slideDelay = newDelay;
      if (slideInterval) {
        clearInterval(slideInterval);
      }
      slideInterval = setInterval(() => {
        if (!paused) {
          window.nextSlide();
        }
      }, slideDelay);
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
}

// Starts a slideshow cycling through the projects data.
function startSlideshow(projects) {
  projectsList = projects; // Save globally for manual controls.
  currentIndex = 0;
  const imgElement = document.getElementById("slideshow-img");
  const projectInfoEl = document.getElementById("project-info");
  const commentInfoEl = document.getElementById("comment-info");

  // Function to update the displayed project info and floating comments.
  function updateOverlay(project) {
    // Update the project details in the header.
    const detailsEl = projectInfoEl.querySelector(".details");
    detailsEl.innerHTML = `<h2>${project.title}</h2>
      <p>${project.description}</p>`;

    // Update the floating comments in the bottom container.
    updateFloatingComments(project.randomComments);
  }

  // Function to update the floating comments container with up to 10 comment bubbles.
  function updateFloatingComments(comments) {
    // Clear previous comments but keep the button controls.
    const existingButtons = document.getElementById("button-controls");
    commentInfoEl.innerHTML = "";
    commentInfoEl.appendChild(existingButtons);

    // Get container dimensions (excluding the controls area).
    const containerWidth = commentInfoEl.clientWidth;
    const containerHeight =
      commentInfoEl.clientHeight - existingButtons.offsetHeight;

    comments.forEach((comment) => {
      const bubble = document.createElement("div");
      bubble.classList.add("comment-bubble", "float");

      // Generate random positions within the container.
      const randomLeft = Math.random() * (containerWidth - 150);
      const randomTop = Math.random() * (containerHeight - 50);
      bubble.style.left = `${randomLeft}px`;
      bubble.style.top = `${randomTop}px`;

      // Randomize animation properties.
      const duration = 4 + Math.random() * 6;
      bubble.style.setProperty("--duration", `${duration}s`);
      const tx = Math.floor(-30 + Math.random() * 60);
      const ty = Math.floor(-30 + Math.random() * 60);
      bubble.style.setProperty("--tx", `${tx}px`);
      bubble.style.setProperty("--ty", `${ty}px`);

      // Build bubble content.
      if (comment.author) {
        bubble.innerHTML = `
          <img class="avatar" src="${comment.author.avatar_url || ""}" alt="${comment.author.username}" />
          <div class="comment-content">
            <span class="username">@${comment.author.username}</span>
            <p class="comment-text">${comment.text}</p>
          </div>
        `;
      } else {
        bubble.innerHTML = `
          <div class="comment-content">
            <p class="comment-text">${comment.text}</p>
          </div>
        `;
      }
      commentInfoEl.appendChild(bubble);
    });
  }

  // Function to update the slide with a fade transition.
  function updateSlide() {
    const currentProject = projectsList[currentIndex];
    const imgFadeDuration = 500; // milliseconds
    // Fade out image.
    imgElement.style.opacity = 0;
    setTimeout(() => {
      imgElement.src = currentProject.image;
      updateOverlay(currentProject);
      imgElement.style.opacity = 1;
    }, imgFadeDuration);
  }

  // Expose next and previous slide functions for manual control.
  window.nextSlide = function () {
    currentIndex = (currentIndex + 1) % projectsList.length;
    updateSlide();
  };

  window.prevSlide = function () {
    currentIndex = (currentIndex - 1 + projectsList.length) % projectsList.length;
    updateSlide();
  };

  // Attach click event on slideshow image for full screen transition.
  imgElement.addEventListener("click", () => {
    if (zooming) return;
    zooming = true;
    // Add zoom animation class.
    imgElement.classList.add("zoom-animation");
  });

  // Listen for the end of the zoom animation.
  imgElement.addEventListener("transitionend", function onZoomEnd(e) {
    if (e.propertyName === "transform" && zooming) {
      const currentProject = projectsList[currentIndex];
      showFullScreenOverlay(currentProject);
      // Remove the zoom animation so that when we come back we reset to normal.
      imgElement.classList.remove("zoom-animation");
      zooming = false;
    }
  });

  // Initialize with the first project.
  imgElement.src = projectsList[currentIndex].image;
  updateOverlay(projectsList[currentIndex]);

  // Auto slideshow: advance every slideDelay milliseconds if not paused.
  slideInterval = setInterval(() => {
    if (!paused) {
      window.nextSlide();
    }
  }, slideDelay);
}

// Function to create and show a full screen overlay with an iframe of the project page.
function showFullScreenOverlay(project) {
  // Create overlay container.
  const overlay = document.createElement("div");
  overlay.id = "fullscreen-overlay";
  
  // Create back button.
  const backButton = document.createElement("button");
  backButton.className = "fullscreen-back-button";
  backButton.textContent = "Back";
  
  // When back button is clicked, remove overlay.
  backButton.addEventListener("click", () => {
    document.body.removeChild(overlay);
  });
  
  // Create iframe element; assuming project page url follows this format.
  const iframe = document.createElement("iframe");
  iframe.src = `https://websim.ai/p/${project.id}`;
  
  // Append back button and iframe to overlay.
  overlay.appendChild(backButton);
  overlay.appendChild(iframe);
  
  // Append overlay to body.
  document.body.appendChild(overlay);
}

// Start initialization once DOM is loaded.
document.addEventListener("DOMContentLoaded", init);