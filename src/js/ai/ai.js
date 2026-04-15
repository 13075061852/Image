// AI entrypoint. Load feature modules in order so global handlers remain available.
document.write('<script src="src/js/ai/ai-state-config.js"><\/script>');
document.write('<script src="src/js/ai/ai-api-vision.js"><\/script>');
document.write('<script src="src/js/ai/ai-knowledge-data.js"><\/script>');
document.write('<script src="src/js/ai/ai-knowledge-ui.js"><\/script>');
document.write('<script src="src/js/ai/ai-analysis.js"><\/script>');
document.write('<script src="src/js/ai/ai-specialist.js"><\/script>');