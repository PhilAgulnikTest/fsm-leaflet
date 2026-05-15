import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { SchoolFlow } from './pages/SchoolFlow';
import { LAFlow } from './pages/LAFlow';
import { EditFlow } from './pages/EditFlow';
import { AdminLogin } from './admin/AdminLogin';
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminTemplates } from './admin/AdminTemplates';
import { AdminLAClients } from './admin/AdminLAClients';
import { AdminTrustDomains } from './admin/AdminTrustDomains';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/customize" element={<Landing />} />
        <Route path="/customize/school" element={<SchoolFlow />} />
        <Route path="/customize/la" element={<LAFlow />} />
        <Route path="/edit/:slug" element={<EditFlow />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<AdminTemplates />} />
          <Route path="templates" element={<AdminTemplates />} />
          <Route path="la-clients" element={<AdminLAClients />} />
          <Route path="trust-domains" element={<AdminTrustDomains />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
