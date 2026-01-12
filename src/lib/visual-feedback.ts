/**
 * Visual Feedback Utilities
 * 
 * Provides subtle visual indicators for WebSocket updates
 * instead of intrusive toast notifications
 */

/**
 * Flash an element with a brief highlight animation
 * @param elementId - The ID of the element to flash
 * @param duration - Duration of the flash in milliseconds (default: 1000)
 */
export function flashElement(elementId: string, duration: number = 1000): void {
  const element = document.getElementById(elementId)
  if (!element) return

  // Add flash class
  element.classList.add('flash-highlight')

  // Remove after duration
  setTimeout(() => {
    element.classList.remove('flash-highlight')
  }, duration)
}

/**
 * Highlight a changed field with a subtle animation
 * @param fieldName - The name/identifier of the field
 * @param element - The DOM element to highlight (optional, will search by data-field if not provided)
 */
export function highlightChange(fieldName: string, element?: HTMLElement): void {
  const targetElement = element || document.querySelector(`[data-field="${fieldName}"]`)
  if (!targetElement) return

  // Add highlight class
  targetElement.classList.add('change-highlight')

  // Remove after animation
  setTimeout(() => {
    targetElement.classList.remove('change-highlight')
  }, 1500)
}

/**
 * Add a CSS class to an element temporarily
 * @param element - The DOM element
 * @param className - The CSS class to add
 * @param duration - Duration in milliseconds
 */
export function addTemporaryClass(
  element: HTMLElement | null,
  className: string,
  duration: number = 1000
): void {
  if (!element) return

  element.classList.add(className)
  setTimeout(() => {
    element.classList.remove(className)
  }, duration)
}
