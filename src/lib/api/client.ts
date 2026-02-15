/**
 * Cliente HTTP centralizado para todas as chamadas de API
 * Facilita a migração de mocks para API real
 */

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

class ApiClient {
  private config: ApiConfig;
  private authToken: string | null = null;

  constructor(config?: Partial<ApiConfig>) {
    this.config = {
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/traccar',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    };
  }

  /**
   * Define o token de autenticação
   */
  setAuthToken(token: string | null) {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  /**
   * Recupera o token de autenticação
   */
  getAuthToken(): string | null {
    if (!this.authToken && typeof window !== 'undefined') {
      this.authToken = localStorage.getItem('auth_token');
    }
    return this.authToken;
  }

  /**
   * Constrói headers com autenticação
   * Nota: Traccar usa autenticação baseada em cookies, não Bearer tokens
   */
  private getHeaders(): Record<string, string> {
    const headers = { ...this.config.headers };
    // Traccar não usa Authorization header, usa cookies de sessão
    // O token é mantido apenas para compatibilidade com o sistema
    return headers;
  }

  /**
   * Trata erros de API
   */
  private handleError(error: any): never {
    const apiError: ApiError = {
      message: error.message || 'Erro desconhecido',
      status: error.status,
      code: error.code,
      details: error.details,
    };

    // Log do erro (pode ser enviado para serviço de monitoramento)
    console.error('API Error:', apiError);

    throw apiError;
  }

  /**
   * Método GET
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      // Construir URL manualmente para evitar problemas com baseURL relativo
      let url = `${this.config.baseURL}${endpoint}`;
      
      if (params) {
        const searchParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
          const value = params[key];
          if (value === undefined || value === null) return;
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        });
        const queryString = searchParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include', // Importante: inclui cookies de sessão
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return await response.json();
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Método POST
   */
  async post<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const url = `${this.config.baseURL}${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'include', // Importante: inclui cookies de sessão
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return await response.json();
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Método PUT
   */
  async put<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const url = `${this.config.baseURL}${endpoint}`;

      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include', // Importante: inclui cookies de sessão
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return await response.json();
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Método PATCH
   */
  async patch<T>(endpoint: string, data?: any): Promise<T> {
    try {
      const url = `${this.config.baseURL}${endpoint}`;

      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include', // Importante: inclui cookies de sessão
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      return await response.json();
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Método DELETE
   */
  async delete<T>(endpoint: string): Promise<T> {
    try {
      const url = `${this.config.baseURL}${endpoint}`;

      const response = await fetch(url, {
        credentials: 'include', // Importante: inclui cookies de sessão
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw {
          message: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      // DELETE pode retornar vazio
      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Instância singleton do cliente
export const apiClient = new ApiClient();

// Helpers para facilitar uso
export const api = {
  get: <T>(endpoint: string, params?: Record<string, any>) => 
    apiClient.get<T>(endpoint, params),
  
  post: <T>(endpoint: string, data?: any) => 
    apiClient.post<T>(endpoint, data),
  
  put: <T>(endpoint: string, data?: any) => 
    apiClient.put<T>(endpoint, data),
  
  patch: <T>(endpoint: string, data?: any) => 
    apiClient.patch<T>(endpoint, data),
  
  delete: <T>(endpoint: string) => 
    apiClient.delete<T>(endpoint),
  
  setAuthToken: (token: string | null) => 
    apiClient.setAuthToken(token),
  
  getAuthToken: () => 
    apiClient.getAuthToken(),
  
  getConfig: () =>
    apiClient['config'],
};
