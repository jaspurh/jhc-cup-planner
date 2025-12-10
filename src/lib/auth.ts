import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { loginSchema } from '@/lib/schemas/auth'
import { logger } from '@/lib/logger'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const validated = loginSchema.parse(credentials)

          const user = await db.user.findUnique({
            where: { email: validated.email },
          })

          if (!user || !user.passwordHash) {
            logger.warn('Login failed: user not found', {
              email: validated.email,
            })
            return null
          }

          // TODO: Add proper password verification with bcrypt
          // const isValidPassword = await bcrypt.compare(validated.password, user.passwordHash)
          // if (!isValidPassword) return null

          logger.info('User logged in', { userId: user.id })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          }
        } catch (error) {
          logger.error('Login error', { error })
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})

