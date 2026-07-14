import{Navigate}from'react-router-dom';import{useAuth}from'../context/AuthContext';
export function Guard({children,admin=false}){const{user}=useAuth();if(user===undefined)return <div className="center-page">Loading…</div>;if(!user)return <Navigate to="/login" replace/>;if(admin&&!user.isAdmin)return <Navigate to="/home" replace/>;return children}
