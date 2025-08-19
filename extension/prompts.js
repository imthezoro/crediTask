// Prompt configuration for LLM enhancement
// You can manually edit the prompts here

const ENHANCEMENT_PROMPTS = {
  tone: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to improve its tone. 

Please enhance the following prompt to have a more professional, clear, and effective tone while maintaining the original intent:

Original prompt: "{prompt}"

Enhanced prompt:`,

  length: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to make it more detailed and comprehensive.

Please enhance the following prompt to be more detailed, specific, and comprehensive while maintaining the original intent:

Original prompt: "{prompt}"

Enhanced prompt:`,

  audience: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to make it more suitable for their target audience.

Please enhance the following prompt to be more appropriate for the intended audience, clearer in communication, and more engaging:

Original prompt: "{prompt}"

Enhanced prompt:`,

  clarity: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to make it clearer and more specific.

Please enhance the following prompt to be clearer, more specific, and easier to understand while maintaining the original intent:

Original prompt: "{prompt}"

Enhanced prompt:`,

  structure: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to improve its structure and organization.

Please enhance the following prompt to be better structured, well-organized, and more logical in its flow:

Original prompt: "{prompt}"

Enhanced prompt:`
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ENHANCEMENT_PROMPTS };
} else {
  window.ENHANCEMENT_PROMPTS = ENHANCEMENT_PROMPTS;
}
