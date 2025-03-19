/**
 * Utility function to create a promise that resolves after a specific time
 * Useful for creating artificial delays or implementing throttling
 * 
 * @param ms - Time to wait in milliseconds
 * @returns Promise that resolves after the specified time
 */
export const wait = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };
  
  /**
   * Debounce function to limit how often a function is called
   * 
   * @param fn - Function to debounce
   * @param ms - Debounce time in milliseconds
   * @returns Debounced function
   */
  export const debounce = <T extends (...args: any[]) => any>(
    fn: T,
    ms = 300
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return function(...args: Parameters<T>) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), ms);
    };
  };
  
  /**
   * Throttle function to limit the rate at which a function is executed
   * 
   * @param fn - Function to throttle
   * @param ms - Throttle time in milliseconds
   * @returns Throttled function
   */
  export const throttle = <T extends (...args: any[]) => any>(
    fn: T,
    ms = 300
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    
    return function(...args: Parameters<T>) {
      const now = Date.now();
      if (now - lastCall < ms) return;
      
      lastCall = now;
      return fn(...args);
    };
  };