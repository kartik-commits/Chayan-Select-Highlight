import * as pdfjsLib from './lib/pdf.mjs';

// 1. Extract the local file path from the URL
const urlParams = new URLSearchParams(window.location.search);
const fileUrl = urlParams.get('file');

if (!fileUrl) {
  document.body.innerHTML = "<h2 style='color: white;'>Error: No file specified.</h2>";
} else {
  // 2. Tell PDF.js where its background worker is located
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.mjs';

  // 3. Load the PDF document
  const loadingTask = pdfjsLib.getDocument(fileUrl);
  
  loadingTask.promise.then(function(pdf) {
    console.log('PDF loaded successfully!');
    
    // For now, let's just render Page 1
    pdf.getPage(1).then(function(page) {
      console.log('Page 1 loaded');
      
      const scale = 1.5; // Zoom level
      const viewport = page.getViewport({ scale: scale });

      // Grab the canvas from our HTML
      const canvas = document.getElementById('pdf-render');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render the PDF page onto the canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      page.render(renderContext).promise.then(function () {
        console.log('Page rendered visually!');
        const textLayerDiv = document.getElementById('text-layer');
        textLayerDiv.style.height = canvas.height + 'px';
        textLayerDiv.style.width = canvas.width + 'px';
        textLayerDiv.innerHTML = '';
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerDiv,
          viewport: viewport
        });
        return textLayer.render();
      }).then(function () {
        console.log('Text layer applied! You can now select text.');
      });
    });
  }).catch(function (error) {
    console.error("Error loading PDF: ", error);
    document.body.innerHTML = `<h2 style='color: white; padding: 20px;'>Failed to load PDF.<br><br>Make sure "Allow access to file URLs" is turned ON in chrome://extensions</h2>`;
  });
}
