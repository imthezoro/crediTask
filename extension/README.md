# PromptOK Extension - Clean Architecture

This document explains the new modular architecture of the PromptOK extension after refactoring.

## Architecture Overview

The extension has been completely reorganized from a single monolithic file (`enhanced-content.js` - 155KB) into a clean, modular architecture following extension best practices.

## File Structure

```
extension/
├── lib/                          # Core modules
│   ├── auth-manager.js          # Authentication management
│   ├── api-client.js            # API communication
│   ├── ui-manager.js            # UI rendering and interactions
│   ├── input-detector.js        # Input element detection
│   └── styles.js                # CSS styling management
├── content-script.js            # Main orchestrator
├── background.js                # Service worker (unchanged)
├── popup.js                     # Extension popup (unchanged)
├── offscreen.js                 # JWT authentication bridge (unchanged)
├── env-config.js                # Environment configuration (unchanged)
├── manifest.json                # Updated to reference new structure
└── enhanced-content.js.backup   # Backup of original file
```

## Module Responsibilities

### 1. AuthManager (`lib/auth-manager.js`)
- Handles all authentication-related functionality
- Manages user profile and session state
- Communicates with background script for JWT tokens
- Provides authentication status checks

**Key Methods:**
- `initializeAuth()` - Initialize authentication
- `checkAuthStatus()` - Check current auth status
- `loadUserProfile()` - Load user profile data
- `hasUsageRemaining()` - Check usage limits

### 2. ApiClient (`lib/api-client.js`)
- Handles all API communication with the backend
- Manages JWT token retrieval and usage
- Provides methods for prompt enhancement and usage logging

**Key Methods:**
- `enhancePrompt()` - Send prompt for enhancement
- `makeAuthenticatedRequest()` - Generic authenticated API calls
- `logUsage()` - Log usage statistics

### 3. UIManager (`lib/ui-manager.js`)
- Manages all UI rendering and user interactions
- Handles overlay creation and management
- Manages user preferences (font scaling, panel sizing)
- Displays error messages and success feedback

**Key Methods:**
- `createFloatingButton()` - Create enhancement buttons
- `showEnhancementOverlay()` - Display enhancement options
- `handleButtonClick()` - Process button interactions
- `showAuthError()` - Display authentication errors

### 4. InputDetector (`lib/input-detector.js`)
- Detects suitable input elements on web pages
- Manages floating button positioning
- Handles dynamic content changes via MutationObserver
- Site-specific detection logic

**Key Methods:**
- `detectInputs()` - Find input elements
- `processInput()` - Process individual inputs
- `isSuitableInput()` - Validate input suitability
- `repositionAllButtons()` - Update button positions

### 5. StylesManager (`lib/styles.js`)
- Manages all CSS styling for the extension
- Injects and removes styles dynamically
- Provides responsive and dark mode support
- Organizes styles by component

**Key Methods:**
- `injectStyles()` - Add extension styles
- `removeStyles()` - Clean up styles
- `getAllStyles()` - Get complete CSS

### 6. PromptOKExtension (`content-script.js`)
- Main orchestrator that coordinates all modules
- Handles initialization and cleanup
- Manages error handling and debugging
- Provides extension statistics and refresh capabilities

**Key Methods:**
- `init()` - Initialize entire extension
- `isSupportedSite()` - Check site compatibility
- `refresh()` - Refresh extension state
- `cleanup()` - Clean up resources

## Benefits of New Architecture

### 1. **Separation of Concerns**
- Each module has a single, well-defined responsibility
- Authentication, UI, API, and detection logic are completely separated
- Easier to understand, test, and maintain

### 2. **Modularity**
- Components can be developed and tested independently
- Easy to add new features or modify existing ones
- Better code reusability

### 3. **Maintainability**
- Much smaller, focused files instead of one massive file
- Clear interfaces between modules
- Easier debugging and error tracking

### 4. **Performance**
- Better memory management with proper cleanup
- More efficient event handling
- Reduced redundant code execution

### 5. **Extensibility**
- Easy to add new UI components or API endpoints
- Simple to support new websites
- Straightforward to add new enhancement options

## Loading Order

The manifest.json loads files in this specific order:

1. `env-config.js` - Environment configuration
2. `lib/auth-manager.js` - Authentication management
3. `lib/api-client.js` - API client
4. `lib/styles.js` - Styling system
5. `lib/ui-manager.js` - UI management
6. `lib/input-detector.js` - Input detection
7. `content-script.js` - Main orchestrator

This order ensures dependencies are available when needed.

## Error Handling

- Each module has its own error handling and logging
- Global error handling in the main content script
- Graceful degradation when components fail
- Comprehensive debugging information

## Development Guidelines

### Adding New Features
1. Identify the appropriate module for the feature
2. Add methods to the relevant class
3. Update the main content script if needed
4. Test the feature in isolation

### Modifying Existing Features
1. Locate the relevant module and method
2. Make changes within the module's scope
3. Ensure interfaces with other modules remain intact
4. Test the changes thoroughly

### Debugging
- Use `window.promptOKExtension.getStats()` for extension statistics
- Each module has debug logging that can be enabled
- Check browser console for detailed error information

## Migration Notes

- Original `enhanced-content.js` is backed up as `enhanced-content.js.backup`
- All functionality has been preserved in the new architecture
- No changes to user-facing features or behavior
- Extension continues to work with existing authentication and API systems

## Future Improvements

- Consider using TypeScript for better type safety
- Add unit tests for individual modules
- Implement more sophisticated error recovery
- Add performance monitoring and analytics
