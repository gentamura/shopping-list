import React from 'react';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'isomorphic-unfetch';
import clientCredentials from '../credentials/client';
import Link from 'next/link';
import Head from '../components/head';

const List = ({ text, handleDelete }) => {
  return (
    <li>
      <label>
        {text}
      </label>
      <a href="" className="uk-icon-button" uk-icon="trash" onClick={handleDelete}></a>
    </li>
  );
};

export default class Home extends React.Component {
  static async getInitialProps ({ req, query }) {
    const user = req && req.session ? req.session.decodedToken : null;
    // don't fetch anything from firebase if the user is not found
    // const snap = user && await req.firebaseServer.database().ref('messages').once('value');
    // const messages = snap && snap.val();
    const messages = null;
    console.log('getInitialProps:user', user);
    return { user, messages };
  }

  constructor (props) {
    super(props);

    this.state = {
      user: this.props.user,
      value: '',
      messages: this.props.messages,
    }

    this.addDbListener = this.addDbListener.bind(this);
    this.removeDbListener = this.removeDbListener.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount () {
    firebase.initializeApp(clientCredentials);

    if (this.state.user) this.addDbListener();

    firebase.auth().onAuthStateChanged(user => {
      console.log('componentDidMount:before:user', user);

      if (user) {
        this.setState({ user: user });

        console.log('after:user', user);
        console.log('user.uid', user.uid);

        return user
          .getIdToken()
          .then(token => {
            // eslint-disable-next-line no-undef
            return fetch('/api/login', {
              method: 'POST',
              // eslint-disable-next-line no-undef
              headers: new Headers({ 'Content-Type': 'application/json' }),
              credentials: 'same-origin',
              body: JSON.stringify({ token }),
            })
          })
          .then(res => this.addDbListener());
      } else {
        this.setState({ user: null });
        // eslint-disable-next-line no-undef
        fetch('/api/logout', {
          method: 'POST',
          credentials: 'same-origin'
        }).then(() => this.removeDbListener());
      }
    });
  }

  async addDbListener() {
    var db = firebase.firestore();

    const usersRef = db.collection('/users');
    const { user } = this.state;

    await usersRef.doc(user.uid).set({
      email: user.email || '',
      name: user.displayName || '',
      icon: user.photoURL || '',
      lastLoggedIn: Date.now(),
    });

    let unsubscribe = db
      .doc(`/users/${user.uid}`)
      .collection('messages')
      .onSnapshot(
        querySnapshot => {
          var messages = new Map();

          querySnapshot.forEach(function (doc) {
            messages.set(doc.id, doc);
          });

          if (messages) this.setState({ messages });
        },
        error => {
          console.error(error);
        }
      );

    this.setState({ unsubscribe });
  }

  removeDbListener () {
    // firebase.database().ref('messages').off();
    if (this.state.unsubscribe) {
      this.state.unsubscribe();
    }
  }

  handleChange (event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();

    var db = firebase.firestore();
    const usersRef = db.collection('/users');
    const { user } = this.state;
    const date = new Date().getTime();

    db.doc(`users/${user.uid}`)
      .collection('messages')
      .doc(`${date}`)
      .set({
        id: date,
        text: this.state.value,
      });

    this.setState({ value: '' });
  }

  handleLogin() {
    const google = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(google)
      .then((result) => { 
        console.log('result', result);
      }, () => {

      })
  }

  handleLogout() {
    firebase.auth().signOut();
  }

  handleDelete(doc) {
    if (!confirm('Are you OK?')) return;

    // Delete on firestore
    doc.ref.delete();

    // Delete on local state
    const messages = Object.assign(new Map(), this.state.messages);
    messages.delete(doc.id);

    this.setState({ messages });
  }

  render() {
    const { user, value, messages } = this.state;

    return (
      <div className="uk-container">
        <Head title="Home" />

        <nav className="uk-navbar-container" uk-navbar="boundary-align: true; align: center;">
          <div className="uk-navbar-left">
            <Link prefetch href="/">
              <a className="uk-navbar-item uk-logo">Shopper</a>
            </Link>
          </div>

          <div class="uk-navbar-right">
            <ul class="uk-navbar-nav">
              <li class="uk-active"><a href=""></a></li>
              <li class="uk-parent"><a href=""></a></li>
              <li>{user ? (
                <a onClick={this.handleLogout}>Logout</a>
                ) : (
                <a onClick={this.handleLogin}>Login</a>
              )}</li>
            </ul>
          </div>
        </nav>

        <div className="uk-grid" uk-grid>
          <div className="uk-width-auto">
            <ul className="uk-nav uk-nav-default">
              <li className="uk-active"><a href="#">Active</a></li>
              <li><a href="#">Item</a></li>
              <li><a href="#">Item</a></li>
            </ul>
          </div>

          <div className="uk-width-expand">
            
            {user && (
              <div>
                <form onSubmit={this.handleSubmit}>
                  <div className="uk-margin">
                    <input
                      className="uk-input"
                      type={'text'}
                      onChange={this.handleChange}
                      placeholder={'add message...'}
                      value={value}
                    />
                  </div>
                </form>

                <ul className="uk-list uk-list-divider">
                  {messages &&
                    Array.from(messages.keys()).map(key => (
                      <List
                        key={key}
                        text={messages.get(key).data().text}
                        handleDelete={this.handleDelete.bind(null, messages.get(key))}
                      />
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
        `}</style>
      </div>
    );
  }
}
