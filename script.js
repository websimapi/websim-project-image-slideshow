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
    
    // Extract project images from project_revision.current_screenshot_url if available.
    const images = data.projects.data
      .filter(
        (item) =>
          item.project_revision &&
          item.project_revision.current_screenshot_url
      )
      .map((item) => item.project_revision.current_screenshot_url);
      
    if (images.length === 0) {
      console.error("No project images available to display.");
      return;
    }
    
    startSlideshow(images);
  } catch (error) {
    console.error("Error fetching projects:", error);
  }
}

// Starts a slideshow cycling through the images every 2 seconds.
function startSlideshow(images) {
  let currentIndex = 0;
  const imgElement = document.getElementById("slideshow-img");
  
  // Initialize with the first image.
  imgElement.src = images[currentIndex];
  
  setInterval(() => {
    currentIndex = (currentIndex + 1) % images.length;
    
    // Fade out the image before switching.
    imgElement.style.opacity = 0;
    setTimeout(() => {
      imgElement.src = images[currentIndex];
      imgElement.style.opacity = 1;
    }, 500); // half of the 2-second interval used for fading effect.
  }, 2000);
}

// Begin initialization once the DOM is completely loaded.
document.addEventListener("DOMContentLoaded", init);