import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Setup MSW server with handlers
export const server = setupServer(...handlers)

// Configure server for tests
server.events.on('request:start', ({ request }) => {
  // Log requests in debug mode
  if (process.env.DEBUG_MSW) {
    console.log('MSW intercepted:', request.method, request.url)
  }
})

server.events.on('response:mocked', ({ request, response }) => {
  // Log mocked responses in debug mode
  if (process.env.DEBUG_MSW) {
    console.log('MSW responded:', request.method, request.url, response.status)
  }
})