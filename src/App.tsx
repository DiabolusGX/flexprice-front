import { RouterProvider } from 'react-router';
import { MainRouter } from '@/core/routes/Routes';
import { UserProvider } from '@/hooks/UserContext';
import { Toaster } from 'react-hot-toast';
import { DocsProvider } from './context/DocsContext';
import ReactQueryProvider from './core/services/tanstack/ReactQueryProvider';
import useVersionCheck from '@/hooks/useVersionCheck';
import { PaddleProvider } from '@/core/paddle';

const App = () => {
	useVersionCheck();

	return (
		<ReactQueryProvider>
			<UserProvider>
				<PaddleProvider>
					<DocsProvider>
						<RouterProvider router={MainRouter} />
					</DocsProvider>

					{/* Toast Notifications */}
					<Toaster
						toastOptions={{
							success: {
								iconTheme: {
									primary: '#5CA7A0',
									secondary: '#fff',
								},
								style: {
									whiteSpace: 'nowrap',
									minWidth: 'fit-content',
									width: 'auto',
									maxWidth: 'none',
								},
								className: 'whitespace-nowrap',
							},
							error: {
								iconTheme: {
									primary: '#E76E50',
									secondary: '#fff',
								},
								// Long API messages (e.g. validation_error) must wrap; nowrap + maxWidth:none
								// makes the bar huge and centers it so most of the text sits off-screen.
								style: {
									whiteSpace: 'normal',
									wordBreak: 'break-word',
									minWidth: 'min(100%, 280px)',
									maxWidth: 'min(calc(100vw - 32px), 520px)',
									width: 'max-content',
								},
								className: 'break-words',
							},
						}}
						position='bottom-center'
						containerStyle={{
							bottom: '80px',
						}}
					/>
					<div id='modal-root'></div>
				</PaddleProvider>
			</UserProvider>
		</ReactQueryProvider>
	);
};

export default App;
