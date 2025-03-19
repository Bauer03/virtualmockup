/**
 * Format a number to a specified number of decimal places
 */
export const formatNumber = (num: number, decimals = 2): string => {
    return num.toFixed(decimals);
  };
  
  /**
   * Parse a value from a form input, with fallback to default
   */
  export const parseValue = <T>(value: string, parser: (val: string) => T, defaultValue: T): T => {
    try {
      const parsed = parser(value);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    } catch (e) {
      return defaultValue;
    }
  };
  
  /**
   * Generate a unique ID for database entries
   */
  export const generateUID = (): number => {
    return Date.now() + Math.floor(Math.random() * 1000);
  };
  
  /**
   * Format a date to a readable string
   */
  export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  /**
   * Convert temperature from Kelvin to Celsius
   */
  export const kelvinToCelsius = (kelvin: number): number => {
    return kelvin - 273.15;
  };
  
  /**
   * Convert temperature from Kelvin to Fahrenheit
   */
  export const kelvinToFahrenheit = (kelvin: number): number => {
    return (kelvin - 273.15) * 9/5 + 32;
  };