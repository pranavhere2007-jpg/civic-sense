// src/aiService.js

export const analyzeCivicIssue = async (imageFile) => {
  console.log("Analyzing image...", imageFile.name);
  
  // THE HACK FOR NOW:
  // To keep development moving today, we will simulate an AI taking 2 seconds 
  // to approve the image. 
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate that the AI found relevant tags
      const isRelevant = true; // Change to false to test rejection
      
      if (isRelevant) {
        resolve({ isValid: true, tags: ["street", "pothole", "waste"] });
      } else {
        resolve({ isValid: false, tags: ["selfie", "cat", "indoor"] });
      }
    }, 2000);
  });

  /* WHEN YOU ARE READY FOR REAL AI, SWAP THE CODE ABOVE FOR THIS:
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch('YOUR_FREE_AI_API_ENDPOINT', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer YOUR_FREE_API_KEY' },
    body: formData
  });
  const data = await response.json();
  // check if data.tags includes "garbage", "pothole", etc.
  // return { isValid: true/false }
  */
};