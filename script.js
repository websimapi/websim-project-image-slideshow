// Fetches a random comment for a given projectId and returns an object with text and author data.
async function fetchRandomComment(projectId) {
  try {
    // Fetch up to 100 comments for the project
    const response = await fetch(
      `/api/v1/projects/${projectId}/comments?first=100&sort_order=desc`
    );
    const data = await response.json();
    const comments = data.comments?.data || [];
    if (comments.length === 0) {
      return { text: "No comments available.", author: null };
    }
    // Select a random comment from fetched data
    const randomIndex = Math.floor(Math.random() * comments.length);
    const selectedComment = comments[randomIndex].comment;
    // Use raw_content if available; otherwise fallback to a placeholder.
    return {
      text: selectedComment.raw_content || "Comment content unavailable.",
      author: selectedComment.author,
    };
  } catch (error) {
    console.error("Error fetching comments for project", projectId, error);
    return { text: "Error loading comment.", author: null };
  }
}

// The init function fetches projects for the current creator and starts the slideshow.
async function init() {
  try {
    // Get the current user who created this page
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
          // Use project data
          id: item.project.id,
          title: item.project.title || "Untitled Project",
          description: item.project.description || "",
          image: item.project_revision.current_screenshot_url,
          randomComment: null, // Placeholder for random comment object
        };
      });

    if (projects.length === 0) {
      console.error("No project images available to display.");
      return;
    }

    // Pre-fetch a random comment for each project concurrently.
    await Promise.all(
      projects.map(async (project) => {
        project.randomComment = await fetchRandomComment(project.id);
      })
    );

    startSlideshow(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
}

// Starts a slideshow cycling through the projects data every 2 seconds.
function startSlideshow(projects) {
  let currentIndex = 0;
  const imgElement = document.getElementById("slideshow-img");
  const projectInfoEl = document.getElementById("project-info");
  const commentInfoEl = document.getElementById("comment-info");

  // Function to update the displayed project info and comment bubble
  function updateOverlay(project) {
    projectInfoEl.innerHTML = `<h2>${project.title}</h2>
      <p>${project.description}</p>`;

    const comment = project.randomComment;
    if (comment && comment.author) {
      // Render the comment with author information and icon in a message bubble.
      commentInfoEl.innerHTML = `
        <div class="comment-bubble">
          <img class="avatar" src="${
            comment.author.avatar_url || ""
          }" alt="${comment.author.username}" />
          <div class="comment-content">
            <span class="username">@${comment.author.username}</span>
            <p class="comment-text">${comment.text}</p>
          </div>
        </div>
      `;
    } else {
      // If no author info, only display comment text.
      commentInfoEl.innerHTML = `
        <div class="comment-bubble">
          <p class="comment-text">${comment ? comment.text : ""}</p>
        </div>
      `;
    }
  }

  // Initialize with the first project
  imgElement.src = projects[currentIndex].image;
  updateOverlay(projects[currentIndex]);

  setInterval(() => {
    currentIndex = (currentIndex + 1) % projects.length;

    // Fade out the image before switching.
    imgElement.style.opacity = 0;
    setTimeout(() => {
      imgElement.src = projects[currentIndex].image;
      updateOverlay(projects[currentIndex]);
      imgElement.style.opacity = 1;
    }, 500); // Half-second fade out interval.
  }, 2000);
}

// Begin initialization once the DOM is completely loaded.
document.addEventListener("DOMContentLoaded", init);