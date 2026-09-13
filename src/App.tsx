'use client'

import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AuthProvider } from '@/contexts/AuthContext'
import { ChatBubbleProvider } from '@/contexts/ChatBubbleContext'
import { DataProvider } from '@/contexts/DataContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AdminPage } from '@/legacy-pages/AdminPage'
import { ChangePasswordPage } from '@/legacy-pages/ChangePasswordPage'
import { GreetPage } from '@/legacy-pages/GreetPage'
import { HomePage } from '@/legacy-pages/HomePage'
import { InboxPage } from '@/legacy-pages/InboxPage'
import { LoginPage } from '@/legacy-pages/LoginPage'
import { ProfilePage } from '@/legacy-pages/ProfilePage'
import { RegisterPage } from '@/legacy-pages/RegisterPage'
import { UsersPage } from '@/legacy-pages/UsersPage'
import { WallPage } from '@/legacy-pages/WallPage'

export default function App() {
  if (typeof window === 'undefined') return null

  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ChatBubbleProvider>
            <ThemeProvider>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="wall" element={<WallPage />} />
                  <Route path="greet" element={<GreetPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="change-password" element={<ChangePasswordPage />} />
                  <Route path="users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
                  <Route path="inbox" element={<ProtectedRoute><InboxPage /></ProtectedRoute>} />
                  <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                  <Route path="admin" element={<ProtectedRoute admin><AdminPage /></ProtectedRoute>} />
                </Route>
              </Routes>
              <Toaster richColors position="top-center" />
            </ThemeProvider>
          </ChatBubbleProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
