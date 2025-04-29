import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import {BrowserRouter, Route, Routes} from 'react-router-dom'
import {useCookies} from 'react-cookie'

const App = () => {

      const [cookies, setCookie, removeCookie] = useCookies(['user'])
      const authToken = cookies.AuthToken

      return (
          <BrowserRouter>
              <Routes>
                  <Route path="/" element={<Home/>}/>
                  <Route path="/dashboard" element={<Dashboard/>}/>
              </Routes>
          </BrowserRouter>
      )
}

export default App;
